import { expect, test, type Page } from '@playwright/test'

const E2E_MARK_TEXT = 'advanced PG features'

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
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem(
        'assistant-message-annotations-v1:e2e-assistant-message',
      )
    })
    await page.goto('/e2e.html')
    await expect(page.getByTestId('e2e-page-title')).toBeVisible()
  })

  test('initial selection opens menu and X dismiss removes transient annotation', async ({
    page,
  }) => {
    const annotationCount = page.getByTestId('e2e-annotation-count')

    await selectTextAndWaitForMenu(page)
    await expect(annotationCount).toContainText('Annotation count: 1')
    await expect(page.getByText('Selected text', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Dismiss selection menu' }).click()
    await expect(page.getByText('Selected text', { exact: false })).toHaveCount(0)
    await expect(annotationCount).toContainText('Annotation count: 0')
  })

  test('clicking an existing annotation opens the selection menu', async ({ page }) => {
    const annotationCount = page.getByTestId('e2e-annotation-count')
    const outsideDismissArea = page.getByTestId('e2e-outside-dismiss-area')

    await selectTextAndWaitForMenu(page)
    await expect(page.getByText('Selected text', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Branch' }).click()
    await expect(page.getByText('Selected text', { exact: false })).toHaveCount(0)
    await expect(annotationCount).toContainText('Annotation count: 1')

    await outsideDismissArea.click()
    const highlightCoords = await getHighlightClickCoordinates(page)
    await page.mouse.click(highlightCoords.x, highlightCoords.y)
    await expect(page.getByText('Selected text', { exact: false })).toBeVisible()
  })
})
