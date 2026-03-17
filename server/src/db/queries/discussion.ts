import type {
  CreateDiscussionInput,
  DiscussionRecord,
} from '../models/discussion.js'
import { query } from '../client.js'

export const listDiscussions = async (): Promise<DiscussionRecord[]> => {
  const result = await query<
    {
      id: string
      title: string
      status: DiscussionRecord['status']
      created_at: string
      updated_at: string
    }
  >(`
    SELECT
      id,
      title,
      status,
      created_at,
      updated_at
    FROM discussions
    ORDER BY created_at DESC
  `)
  return result.rows.map((row: {
    id: string
    title: string
    status: DiscussionRecord['status']
    created_at: string
    updated_at: string
  }) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export const getDiscussionById = async (id: string): Promise<DiscussionRecord | null> => {
  const result = await query<
    {
      id: string
      title: string
      status: DiscussionRecord['status']
      created_at: string
      updated_at: string
    }
  >(
    `
    SELECT
      id,
      title,
      status,
      created_at,
      updated_at
    FROM discussions
    WHERE id = $1
  `,
    [id],
  )
  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const createDiscussion = async (
  input: CreateDiscussionInput,
): Promise<DiscussionRecord> => {
  const result = await query<
    {
      id: string
      title: string
      status: string
      created_at: string
      updated_at: string
    }
  >(
    `
    INSERT INTO discussions (title, status)
    VALUES ($1, COALESCE($2, 'open'))
    RETURNING id, title, status, created_at, updated_at
    `,
    [input.title, input.status ?? null],
  )

  const row = result.rows[0]
  return {
    id: row.id,
    title: row.title,
    status: row.status as DiscussionRecord['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
