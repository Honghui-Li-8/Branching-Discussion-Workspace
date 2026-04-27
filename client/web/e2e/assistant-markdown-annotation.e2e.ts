import { expect, test, type Page, type Route } from '@playwright/test'

const ANNOTATION_FIXTURE_MESSAGE_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890'
const QUOTE = 'Second ordered item for offset testing'

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

const toSortedBatchValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
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
    if (!rawInput) return []
    const parsed = JSON.parse(rawInput) as unknown
    return isBatch ? toSortedBatchValues(parsed) : [parsed]
  }
  const rawBody = route.request().postData()
  if (!rawBody) return []
  const parsed = JSON.parse(rawBody) as unknown
  return isBatch ? toSortedBatchValues(parsed) : [parsed]
}

const installMockTrpcBackend = async (page: Page, state: MockBackendState) => {
  await page.route('**/trpc/**', async (route) => {
    const url = new URL(route.request().url())
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
              selector: Array<{ quote: string; start: number; end: number }>
            }
          }
        }>(rawInput)

        const lookupKey = `${input.messageId}:${input.idempotencyKey}`
        const existing = state.branchResultByIdempotencyKey.get(lookupKey)
        if (existing) return { result: { data: existing } }

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
        const existing2 = state.annotationsByMessageId.get(input.messageId) ?? []
        state.annotationsByMessageId.set(input.messageId, [...existing2, annotation])
        state.branchResultByIdempotencyKey.set(lookupKey, branchResult)
        return { result: { data: branchResult } }
      }

      return {
        error: {
          message: `Unhandled mock tRPC procedure: ${procedureName}`,
          code: -32603,
          data: { code: 'INTERNAL_SERVER_ERROR', httpStatus: 500, path: procedureName },
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

// Uses TreeWalker to locate the text node containing targetText inside the
// markdown annotation fixture section — needed because react-markdown splits
// content across multiple DOM nodes inside <li> / <p> elements.
const getMarkdownTextSelectionCoords = async (page: Page, targetText: string) => {
  const coords = await page.evaluate((target: string) => {
    const scope = document.querySelector(
      '[data-testid="markdown-annotation-section"] .model-markdown',
    )
    if (!scope) return null

    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT)
    let foundNode: Text | null = null

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      if ((node.textContent ?? '').includes(target)) {
        foundNode = node
        break
      }
    }

    if (!foundNode) return null

    const content = foundNode.textContent ?? ''
    const startOffset = content.indexOf(target)
    if (startOffset < 0) return null
    const endOffset = startOffset + target.length

    const startRange = document.createRange()
    startRange.setStart(foundNode, startOffset)
    startRange.setEnd(foundNode, startOffset + 1)
    const startRect = startRange.getBoundingClientRect()

    const endRange = document.createRange()
    endRange.setStart(foundNode, endOffset - 1)
    endRange.setEnd(foundNode, endOffset)
    const endRect = endRange.getBoundingClientRect()

    return {
      startX: startRect.left + 1,
      startY: startRect.top + startRect.height / 2,
      endX: endRect.right - 1,
      endY: endRect.top + endRect.height / 2,
    }
  }, targetText)

  if (!coords) throw new Error(`Cannot locate text node for: "${targetText}"`)
  return coords
}

const dragSelectMarkdownText = async (page: Page, targetText: string) => {
  const coords = await getMarkdownTextSelectionCoords(page, targetText)
  await page.mouse.move(coords.startX, coords.startY)
  await page.mouse.down()
  await page.mouse.move(coords.endX, coords.endY)
  await page.mouse.up()
}

const selectMarkdownTextAndWaitForMenu = async (page: Page, targetText: string) => {
  const selectionMenuTitle = page.getByText('Selected text', { exact: false })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await dragSelectMarkdownText(page, targetText)
    try {
      await expect(selectionMenuTitle).toBeVisible({ timeout: 1500 })
      return
    } catch {
      await page.mouse.click(4, 4)
    }
  }

  throw new Error('Selection menu did not open after selecting markdown annotation text.')
}

test.describe('assistant markdown annotation offset and rehydration', () => {
  let backendState: MockBackendState
  let pageErrors: Error[]

  test.beforeEach(async ({ page }) => {
    pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(err))
    backendState = createMockBackendState()
    await installMockTrpcBackend(page, backendState)
    await page.goto('/e2e.html?fixture=markdown')
    await expect(page.getByTestId('e2e-page-title')).toBeVisible()
  })

  test('branch from markdown list item sends correct quote and consistent offsets', async ({
    page,
  }) => {
    await selectMarkdownTextAndWaitForMenu(page, QUOTE)
    await page.getByRole('button', { name: 'Branch' }).click()

    await expect.poll(() => backendState.branchRequests).toBe(1)

    const annotations = backendState.annotationsByMessageId.get(ANNOTATION_FIXTURE_MESSAGE_ID) ?? []
    expect(annotations).toHaveLength(1)

    const annotation = annotations[0]!
    expect(annotation.quote).toBe(QUOTE)
    expect((annotation.endOffset ?? 0) - (annotation.startOffset ?? 0)).toBe(QUOTE.length)
    expect(annotation.selectorJson.selector[0]?.quote).toBe(QUOTE)

    expect(pageErrors).toHaveLength(0)
  })

  test('persisted annotation rehydrates as highlight element after page reload', async ({
    page,
  }) => {
    await selectMarkdownTextAndWaitForMenu(page, QUOTE)
    await page.getByRole('button', { name: 'Branch' }).click()
    await expect.poll(() => backendState.branchRequests).toBe(1)

    await page.reload()
    await expect(page.getByTestId('e2e-page-title')).toBeVisible()

    await expect(page.locator('.r6o-span-highlight-layer .r6o-annotation')).toBeVisible()

    expect(pageErrors).toHaveLength(0)
  })
})
