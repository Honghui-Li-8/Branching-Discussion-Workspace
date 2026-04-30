import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ExampleWorkspaceKey } from '@branching/shared/router/schemas/core'
import {
  createWorkspaceFromRestoredData,
  restoreWorkspaceFromJsonFile,
  type WorkspaceExportPayload,
} from '../../utils/workspace/importExport.js'

const dir = dirname(fileURLToPath(import.meta.url))

const EXAMPLE_PATHS: Record<ExampleWorkspaceKey, string> = {
  'project-decision': resolve(dir, '../seeds/introWorkspace.json'),
  'database-selection': resolve(dir, '../seeds/database-selection.json'),
}

const cache = new Map<ExampleWorkspaceKey, Promise<WorkspaceExportPayload>>()

const loadExample = (key: ExampleWorkspaceKey): Promise<WorkspaceExportPayload> => {
  if (!cache.has(key)) {
    cache.set(key, restoreWorkspaceFromJsonFile(EXAMPLE_PATHS[key]))
  }
  return cache.get(key)!
}

export const createWorkspaceFromExample = async (
  key: ExampleWorkspaceKey,
  userId: string,
) => {
  const data = await loadExample(key)
  const { workspace } = await createWorkspaceFromRestoredData({
    restoredData: data,
    targetAuthorUserId: userId,
  })
  return workspace
}
