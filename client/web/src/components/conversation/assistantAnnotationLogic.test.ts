import { describe, expect, test } from '@jest/globals'
import {
  ASSISTANT_ANNOTATION_KIND_PREFIX,
  getAnnotationInteractionMode,
  getBranchActionKind,
  isDisplayOnlyAnnotationKind,
  parseAnnotationKindTag,
  resolveAnnotationKind,
  shouldDeleteAnnotationOnDismiss,
} from './assistantAnnotationLogic'

describe('assistantAnnotationLogic', () => {
  test('parses supported legacy kind tags', () => {
    expect(
      parseAnnotationKindTag(`${ASSISTANT_ANNOTATION_KIND_PREFIX}suggestion`),
    ).toBe('suggestion')
    expect(
      parseAnnotationKindTag(`${ASSISTANT_ANNOTATION_KIND_PREFIX}branch`),
    ).toBe('branch')
    expect(
      parseAnnotationKindTag(`${ASSISTANT_ANNOTATION_KIND_PREFIX}suggestion-branch`),
    ).toBe('suggestion-branch')
  })

  test('resolveAnnotationKind prefers properties over legacy tag', () => {
    expect(
      resolveAnnotationKind({
        propertiesKind: 'suggestion',
        legacyTagValue: `${ASSISTANT_ANNOTATION_KIND_PREFIX}branch`,
      }),
    ).toBe('suggestion')
  })

  test('resolveAnnotationKind falls back to legacy tag then branch default', () => {
    expect(
      resolveAnnotationKind({
        propertiesKind: undefined,
        legacyTagValue: `${ASSISTANT_ANNOTATION_KIND_PREFIX}suggestion-branch`,
      }),
    ).toBe('suggestion-branch')

    expect(
      resolveAnnotationKind({
        propertiesKind: undefined,
        legacyTagValue: 'unknown-tag',
      }),
    ).toBe('branch')
  })

  test('branch action upgrades suggestion to suggestion-branch', () => {
    expect(getBranchActionKind('suggestion')).toBe('suggestion-branch')
    expect(getBranchActionKind('branch')).toBe('branch')
    expect(getBranchActionKind('suggestion-branch')).toBe('branch')
    expect(getBranchActionKind('branch-origin')).toBe('branch')
  })

  test('branch-origin is treated as a display-only annotation kind', () => {
    expect(isDisplayOnlyAnnotationKind('branch-origin')).toBe(true)
    expect(isDisplayOnlyAnnotationKind('branch')).toBe(false)
  })

  test('interaction mode is edit for normal child-local annotations', () => {
    expect(getAnnotationInteractionMode({ kind: 'suggestion', readOnly: false })).toBe('edit')
    expect(getAnnotationInteractionMode({ kind: 'branch', readOnly: false })).toBe('edit')
    expect(getAnnotationInteractionMode({ kind: 'suggestion-branch', readOnly: false })).toBe('edit')
  })

  test('interaction mode is select for branch-origin and none for read-only rows', () => {
    expect(getAnnotationInteractionMode({ kind: 'branch-origin', readOnly: false })).toBe('select')
    expect(getAnnotationInteractionMode({ kind: 'branch-origin', readOnly: true })).toBe('none')
    expect(getAnnotationInteractionMode({ kind: 'branch', readOnly: true })).toBe('none')
  })

  test('inherited parent rows: all annotation kinds return none regardless of kind', () => {
    // When readOnly=true the row is an inherited parent message — the user must not
    // be able to create, edit, or select annotations on it. This is the core guardrail
    // that prevents annotation affordances from appearing on inherited content.
    const allKinds = ['branch', 'suggestion', 'suggestion-branch', 'branch-origin'] as const
    for (const kind of allKinds) {
      expect(getAnnotationInteractionMode({ kind, readOnly: true })).toBe('none')
    }
  })

  test('non-read-only rows: branch-origin is the only kind that returns select', () => {
    // In child-local rows (readOnly=false), branch-origin annotations are display-only
    // (they mark where the branch came from) so they return 'select'. All other kinds
    // that are editable return 'edit'. This ensures no edit affordance appears on
    // branch-origin annotations even when the row is fully interactive.
    expect(getAnnotationInteractionMode({ kind: 'branch-origin', readOnly: false })).toBe('select')
    const editableKinds = ['branch', 'suggestion', 'suggestion-branch'] as const
    for (const kind of editableKinds) {
      expect(getAnnotationInteractionMode({ kind, readOnly: false })).toBe('edit')
    }
  })

  test('dismiss deletion rules: transient deletes, persisted keeps', () => {
    const transient = new Set<string>(['a-transient'])
    const persisted = new Set<string>(['a-persisted'])

    expect(
      shouldDeleteAnnotationOnDismiss('a-transient', transient, persisted),
    ).toBe(true)
    expect(
      shouldDeleteAnnotationOnDismiss('a-persisted', transient, persisted),
    ).toBe(false)
    expect(
      shouldDeleteAnnotationOnDismiss('unknown', transient, persisted),
    ).toBe(true)
  })
})

describe('regression: pre-existing annotation kinds unaffected by branch-origin addition', () => {
  test('suggestion and branch kinds: isDisplayOnlyAnnotationKind remains false', () => {
    // Adding branch-origin as a display-only kind must not change the false result for
    // all pre-existing annotation kinds. Any regressions here would break annotation
    // editing in the standard branch-from-selection and suggestion flows.
    expect(isDisplayOnlyAnnotationKind('suggestion')).toBe(false)
    expect(isDisplayOnlyAnnotationKind('branch')).toBe(false)
    expect(isDisplayOnlyAnnotationKind('suggestion-branch')).toBe(false)
    expect(isDisplayOnlyAnnotationKind('branch-origin')).toBe(true) // only this one
  })

  test('getBranchActionKind still upgrades suggestion→suggestion-branch and suggestion-branch→branch unchanged', () => {
    // The Commit 7 addition of branch-origin handling must not disturb the existing
    // kind upgrade chain used in the branch-from-selection and suggestion flows.
    expect(getBranchActionKind('suggestion')).toBe('suggestion-branch')
    expect(getBranchActionKind('suggestion-branch')).toBe('branch')
    expect(getBranchActionKind('branch')).toBe('branch')
    // branch-origin specifically downgrades to plain branch (not suggestion-branch).
    expect(getBranchActionKind('branch-origin')).toBe('branch')
  })

  test('dismiss-deletion lifecycle is correct for all annotation kinds including branch-origin', () => {
    // shouldDeleteAnnotationOnDismiss logic must be unchanged for pre-existing kinds
    // and must apply consistently to the new branch-origin kind.
    const transient = new Set(['a-suggestion', 'a-branch-origin'])
    const persisted = new Set(['a-branch', 'a-suggestion-branch'])

    // Pre-existing lifecycle: transient is deleted, persisted is kept.
    expect(shouldDeleteAnnotationOnDismiss('a-suggestion', transient, persisted)).toBe(true)
    expect(shouldDeleteAnnotationOnDismiss('a-branch', transient, persisted)).toBe(false)
    expect(shouldDeleteAnnotationOnDismiss('a-suggestion-branch', transient, persisted)).toBe(false)

    // New branch-origin kind follows the same transient/persisted rule.
    expect(shouldDeleteAnnotationOnDismiss('a-branch-origin', transient, persisted)).toBe(true)

    // Unknown ID still defaults to delete (pre-existing behaviour unchanged).
    expect(shouldDeleteAnnotationOnDismiss('completely-unknown', transient, persisted)).toBe(true)
  })
})
