import type { BranchRecord, CreateBranchInput } from '../models/branch.js'
import { query } from '../client.js'

export const listBranchesForDiscussion = async (
  discussionId: string,
): Promise<BranchRecord[]> => {
  const result = await query<{
    id: string
    discussion_id: string
    parent_branch_id: string | null
    content: string
    created_at: string
    updated_at: string
  }>(
    `
    SELECT
      id,
      discussion_id,
      parent_branch_id,
      content,
      created_at,
      updated_at
    FROM branches
    WHERE discussion_id = $1
    ORDER BY created_at ASC
  `,
    [discussionId],
  )

  return result.rows.map((row: {
    id: string
    discussion_id: string
    parent_branch_id: string | null
    content: string
    created_at: string
    updated_at: string
  }) => ({
    id: row.id,
    discussionId: row.discussion_id,
    parentBranchId: row.parent_branch_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const createBranch = async (input: CreateBranchInput): Promise<BranchRecord> => {
  const result = await query<{
    id: string
    discussion_id: string
    parent_branch_id: string | null
    content: string
    created_at: string
    updated_at: string
  }>(
    `
    INSERT INTO branches (discussion_id, parent_branch_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, discussion_id, parent_branch_id, content, created_at, updated_at
    `,
    [input.discussionId, input.parentBranchId ?? null, input.content],
  )

  const row = result.rows[0]
  return {
    id: row.id,
    discussionId: row.discussion_id,
    parentBranchId: row.parent_branch_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
