import { expect, test, type Page, type Route } from '@playwright/test'

const E2E_MESSAGE_ID = 'e2e-assistant-message'
const E2E_MARK_TEXT = 'advanced PG features'

type PersistedAnnotation = {
  id: string
  messageId: string
  leadsToNodeId: string | null
  kind: 'branch' | 'suggestion' | 'suggestion-branch'
  quote: string
  startOffset?: number | null
  endOffset?: number | null
  selectorJson: {
    selector: Array<{
      quote: string
      start: number
      end: number
    }>
  }
  createdByUserId: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

type MockBranchResult = {
  annotation: PersistedAnnotation
  branchNodeId: string
}

type MockBackendState = {
  annotationsByMessageId: Map<string, PersistedAnnotation[]>
  branchResultByIdempotencyKey: Map<string, MockBranchResult>
  nextAnnotationNumber: number
  nextBranchNodeNumber: number
  listRequests: number
  branchRequests: number
}

const createMockBackendState = (): MockBackendState => ({
  annotationsByMessageId: new Map(),
  branchResultByIdempotencyKey: new Map(),
  nextAnnotationNumber: 1,
  nextBranchNodeNumber: 1,
  listRequests: 0,
  branchRequests: 0,
})

const getLegacyAnnotationStorageKeys = async (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) =>
      key.startsWith('assistant-message-annotations-v1:'),
    ),
  )

const toSortedBatchValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  return Object.entries(value)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, entry]) => entry)
}

const unwrapInputValue = <T>(input: unknown): T => {
  if (input && typeof input === 'object' && 'json' in input) {
    return (input as { json: T }).json
  }

  return input as T
}

const parseRouteInputs = (route: Route, url: URL, isBatch: boolean): unknown[] => {
  if (route.request().method() === 'GET') {
    const rawInput = url.searchParams.get('input')
    if (!rawInput) {
      return []
    }

    const parsed = JSON.parse(rawInput) as unknown
    return isBatch ? toSortedBatchValues(parsed) : [parsed]
  }

  const rawBody = route.request().postData()
  if (!rawBody) {
    return []
  }

  const parsed = JSON.parse(rawBody) as unknown
  return isBatch ? toSortedBatchValues(parsed) : [parsed]
}

const installMockTrpcBackend = async (page: Page, state: MockBackendState) => {
  await page.route('**/trpc/**', async (route) => {
    const requestUrl = route.request().url()
    const url = new URL(requestUrl)
    const marker = '/trpc/'
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex < 0) {
      await route.fallback()
      return
    }

    const procedurePath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
    const procedureNames = procedurePath.split(',').filter(Boolean)
    if (procedureNames.length === 0) {
      await route.fallback()
      return
    }

    const isBatch = url.searchParams.get('batch') === '1'
    const rawInputs = parseRouteInputs(route, url, isBatch)

    const responses = procedureNames.map((procedureName, index) => {
      const rawInput = rawInputs[index]

      if (procedureName === 'messageAnnotationsByMessage') {
        state.listRequests += 1
        const input = unwrapInputValue<{ messageId: string }>(rawInput)
        const annotations = state.annotationsByMessageId.get(input.messageId) ?? []
        return { result: { data: annotations } }
      }

      if (procedureName === 'messageBranchFromSelection') {
        state.branchRequests += 1
        const input = unwrapInputValue<{
          messageId: string
          idempotencyKey: string
          annotationKind?: 'branch' | 'suggestion-branch'
          selection: {
            quote: string
            startOffset?: number
            endOffset?: number
            selectorJson: {
              selector: Array<{
                quote: string
                start: number
                end: number
              }>
            }
          }
        }>(rawInput)

        const idempotencyLookupKey = `${input.messageId}:${input.idempotencyKey}`
        const existing = state.branchResultByIdempotencyKey.get(idempotencyLookupKey)
        if (existing) {
          return { result: { data: existing } }
        }

        const createdAt = new Date().toISOString()
        const annotation: PersistedAnnotation = {
          id: `mock-annotation-${state.nextAnnotationNumber}`,
          messageId: input.messageId,
          leadsToNodeId: `mock-branch-node-${state.nextBranchNodeNumber}`,
          kind: input.annotationKind === 'suggestion-branch' ? 'suggestion-branch' : 'branch',
          quote: input.selection.quote,
          startOffset: input.selection.startOffset ?? null,
          endOffset: input.selection.endOffset ?? null,
          selectorJson: input.selection.selectorJson,
          createdByUserId: 'mock-user',
          createdAt,
          updatedAt: createdAt,
          deletedAt: null,
        }
        const branchResult: MockBranchResult = {
          annotation,
          branchNodeId: annotation.leadsToNodeId ?? `mock-branch-node-${state.nextBranchNodeNumber}`,
        }

        state.nextAnnotationNumber += 1
        state.nextBranchNodeNumber += 1
        const existingAnnotations = state.annotationsByMessageId.get(input.messageId) ?? []
        state.annotationsByMessageId.set(input.messageId, [...existingAnnotations, annotation])
        state.branchResultByIdempotencyKey.set(idempotencyLookupKey, branchResult)
        return { result: { data: branchResult } }
      }

      return {
        error: {
          message: `Unhandled mock tRPC procedure: ${procedureName}`,
          code: -32603,
          data: {
            code: 'INTERNAL_SERVER_ERROR',
            httpStatus: 500,
            path: procedureName,
          },
        },
      }
    })

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(isBatch ? responses : responses[0]),
    })
  })
}

const getSelectionDragCoordinates = async (page: Page) => {
  const coords = await page.evaluate((targetText: string) => {
    const paragraph = document.querySelector('[data-testid="e2e-annotation-text"]')
    const textNode = paragraph?.firstChild
    if (!paragraph || !textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return null
    }

    const content = textNode.textContent ?? ''
    const startOffset = content.indexOf(targetText)
    if (startOffset < 0) {
      return null
    }

    const endOffset = startOffset + targetText.length

    const startRange = document.createRange()
    startRange.setStart(textNode, startOffset)
    startRange.setEnd(textNode, startOffset + 1)
    const startRect = startRange.getBoundingClientRect()

    const endRange = document.createRange()
    endRange.setStart(textNode, endOffset - 1)
    endRange.setEnd(textNode, endOffset)
    const endRect = endRange.getBoundingClientRect()

    const fullRange = document.createRange()
    fullRange.setStart(textNode, startOffset)
    fullRange.setEnd(textNode, endOffset)
    const fullRect = fullRange.getBoundingClientRect()

    return {
      startX: startRect.left + 1,
      startY: startRect.top + startRect.height / 2,
      endX: endRect.right - 1,
      endY: endRect.top + endRect.height / 2,
      clickX: fullRect.left + fullRect.width / 2,
      clickY: fullRect.top + fullRect.height / 2,
    }
  }, E2E_MARK_TEXT)

  if (!coords) {
    throw new Error('Unable to compute text selection coordinates for e2e harness.')
  }

  return coords
}

const dragSelectMarkText = async (page: Page) => {
  const coords = await getSelectionDragCoordinates(page)
  await page.mouse.move(coords.startX, coords.startY)
  await page.mouse.down()
  await page.mouse.move(coords.endX, coords.endY)
  await page.mouse.up()
}

const selectTextAndWaitForMenu = async (page: Page) => {
  const selectionMenuTitle = page.getByText('Selected text', { exact: false })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await dragSelectMarkText(page)

    try {
      await expect(selectionMenuTitle).toBeVisible({ timeout: 1500 })
      return
    } catch {
      // Clear any partial browser selection before retrying.
      await page.mouse.click(4, 4)
    }
  }

  throw new Error('Selection menu did not open after selecting mark text.')
}

const getHighlightClickCoordinates = async (page: Page) => {
  const coords = await page.evaluate(() => {
    const firstHighlight = document.querySelector<HTMLElement>(
      '.r6o-span-highlight-layer .r6o-annotation[data-annotation]',
    )
    if (!firstHighlight) {
      return null
    }

    const rect = firstHighlight.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  })

  if (!coords) {
    throw new Error('Unable to compute existing-highlight click coordinates.')
  }

  return coords
}

test.describe('assistant annotation dismiss behavior', () => {
  let backendState: MockBackendState

  test.beforeEach(async ({ page }) => {
    backendState = createMockBackendState()
    await installMockTrpcBackend(page, backendState)
    await page.goto('/e2e.html')
    await expect(page.getByTestId('e2e-page-title')).toBeVisible()
    await expect(page.getByTestId('e2e-backend-annotation-count')).toContainText(
      'Backend annotation count: 0',
    )
  })

  test('initial selection opens menu and X dismiss removes transient annotation', async ({
    page,
  }) => {
    const annotationCount = page.getByTestId('e2e-annotation-count')
    const backendAnnotationCount = page.getByTestId('e2e-backend-annotation-count')

    await selectTextAndWaitForMenu(page)
    await expect(annotationCount).toContainText('Annotation count: 1')
    await expect(page.getByText('Selected text', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss selection menu' }).click()
    await expect(page.getByText('Selected text', { exact: false })).toHaveCount(0)
    await expect(annotationCount).toContainText('Annotation count: 0')
    await expect(backendAnnotationCount).toContainText('Backend annotation count: 0')
    expect(backendState.branchRequests).toBe(0)
  })

  test('branch persists across reload and rehydrates from backend query', async ({ page }) => {
    const annotationCount = page.getByTestId('e2e-annotation-count')
    const backendAnnotationCount = page.getByTestId('e2e-backend-annotation-count')
    const outsideDismissArea = page.getByTestId('e2e-outside-dismiss-area')

    await selectTextAndWaitForMenu(page)
    await expect(page.getByText('Selected text', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Branch' }).click()
    await expect(page.getByText('Selected text', { exact: false })).toHaveCount(0)
    await expect(annotationCount).toContainText('Annotation count: 1')
    await expect(backendAnnotationCount).toContainText('Backend annotation count: 1')
    await expect.poll(() => backendState.branchRequests).toBe(1)
    await expect(getLegacyAnnotationStorageKeys(page)).resolves.toHaveLength(0)

    await page.reload()
    await expect(page.getByTestId('e2e-page-title')).toBeVisible()
    await expect(backendAnnotationCount).toContainText('Backend annotation count: 1')
    await expect(annotationCount).toContainText('Annotation count: 1')
    expect(backendState.listRequests).toBeGreaterThanOrEqual(2)
    expect(backendState.annotationsByMessageId.get(E2E_MESSAGE_ID)).toHaveLength(1)
    await expect(getLegacyAnnotationStorageKeys(page)).resolves.toHaveLength(0)

    await outsideDismissArea.click()
    const highlightCoords = await getHighlightClickCoordinates(page)
    await page.mouse.click(highlightCoords.x, highlightCoords.y)
    await expect(page.getByText('Selected text', { exact: false })).toBeVisible()
  })
})
