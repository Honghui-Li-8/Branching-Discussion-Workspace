import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from '../client.js'
import type { WorkspaceRecord } from '../models/workspace.js'
import {
  createWorkspaceFromRestoredData,
  restoreWorkspaceFromJsonFile,
  type WorkspaceExportPayload,
} from '../../utils/workspace/importExport.js'

type WorkspaceRow = {
  id: string
  title: string
  summary: string | null
  author_user_id: string
  root_node_id: string
  created_at: string
  updated_at: string
}

const mapWorkspaceRow = (row: WorkspaceRow): WorkspaceRecord => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  authorUserId: row.author_user_id,
  rootNodeId: row.root_node_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const introWorkspacePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../seeds/introWorkspace.json',
)

let introWorkspaceDataPromise: Promise<WorkspaceExportPayload> | null = null
const loadIntroWorkspaceData = async (): Promise<WorkspaceExportPayload> => {
  if (!introWorkspaceDataPromise) {
    introWorkspaceDataPromise = restoreWorkspaceFromJsonFile(introWorkspacePath)
  }
  return introWorkspaceDataPromise
}

const introWorkspaceSeedLocks = new Map<string, Promise<WorkspaceRecord>>()

export const seedIntroWorkspace = async (authorUserId: string): Promise<WorkspaceRecord> => {
  // NOTE: @todo This lock is process-local only; it does not coordinate across multiple server instances.
  const inFlightSeed = introWorkspaceSeedLocks.get(authorUserId)
  if (inFlightSeed) {
    return inFlightSeed
  }

  const seedPromise = (async (): Promise<WorkspaceRecord> => {
    const introWorkspaceData = await loadIntroWorkspaceData()
    const introWorkspaceTitle = introWorkspaceData.workspace.title

    // @todo(seed-idempotency): Enforce DB-level uniqueness for (author_user_id, intro workspace title)
    // and replace this process-local lock with an upsert/constraint-backed flow.
    const existingResult = await query<WorkspaceRow>(
      `
      SELECT
        w.id,
        w.title,
        NULLIF(BTRIM(rn.summary), '') AS summary,
        w.author_user_id,
        w.root_node_id,
        w.created_at,
        w.updated_at
      FROM workspaces w
      LEFT JOIN nodes rn ON rn.id = w.root_node_id
      WHERE w.author_user_id = $1
        AND w.title = $2
      ORDER BY w.created_at ASC
      LIMIT 1
      `,
      [authorUserId, introWorkspaceTitle],
    )

    if (existingResult.rows.length > 0) {
      return mapWorkspaceRow(existingResult.rows[0])
    }

    const { workspace } = await createWorkspaceFromRestoredData({
      restoredData: introWorkspaceData,
      targetAuthorUserId: authorUserId,
      workspaceTitle: introWorkspaceTitle,
    })

    return workspace
  })()

  introWorkspaceSeedLocks.set(authorUserId, seedPromise)
  try {
    return await seedPromise
  } finally {
    if (introWorkspaceSeedLocks.get(authorUserId) === seedPromise) {
      introWorkspaceSeedLocks.delete(authorUserId)
    }
  }
}
