import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ExampleWorkspaceKey } from '@branching/shared/router/schemas/core'
import {
  createWorkspaceFromRestoredData,
  restoreWorkspaceFromJsonFile,
  type WorkspaceExportPayload,
} from '../../utils/workspace/importExport.js'

const resolveSeedPath = (fileName: string): string => {
  const candidates = [
    resolve(process.cwd(), 'server/src/db/seeds', fileName),
    resolve(process.cwd(), 'src/db/seeds', fileName),
  ]
  return candidates.find((path) => existsSync(path)) ?? candidates[0]
}

const EXAMPLE_PATHS: Record<ExampleWorkspaceKey, string> = {
  'project-decision': resolveSeedPath('introWorkspace.json'),
  'database-selection': resolveSeedPath('database-selection.json'),
  'project-walkthrough': resolveSeedPath('project-walkthrough.json'),
  'project-walkthrough-script': resolveSeedPath('project-walkthrough-script.json'),
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
