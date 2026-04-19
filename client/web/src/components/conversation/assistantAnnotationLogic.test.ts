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
