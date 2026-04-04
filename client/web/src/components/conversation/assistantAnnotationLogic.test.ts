import { describe, expect, test } from '@jest/globals'
import {
  ASSISTANT_ANNOTATION_KIND_PREFIX,
  getBranchActionKind,
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
