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
