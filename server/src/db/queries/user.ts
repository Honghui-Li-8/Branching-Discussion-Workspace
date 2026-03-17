import type { CreateUserInput, UserRecord } from '../models/user.js'
import { query } from '../client.js'

type UserRow = {
  id: string
  auth_user_id: string
  email: string | null
  display_name: string | null
  credit_balance: string
  created_at: string
  updated_at: string
}

const mapUserRow = (row: UserRow): UserRecord => ({
  id: row.id,
  authUserId: row.auth_user_id,
  email: row.email,
  displayName: row.display_name,
  creditBalance: Number(row.credit_balance),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const listUsers = async (): Promise<UserRecord[]> => {
  const result = await query<UserRow>(
    `
    SELECT
      id,
      auth_user_id,
      email,
      display_name,
      credit_balance,
      created_at,
      updated_at
    FROM users
    ORDER BY created_at DESC
    `,
  )

  return result.rows.map(mapUserRow)
}

export const getUserById = async (id: string): Promise<UserRecord | null> => {
  const result = await query<UserRow>(
    `
    SELECT
      id,
      auth_user_id,
      email,
      display_name,
      credit_balance,
      created_at,
      updated_at
    FROM users
    WHERE id = $1
    `,
    [id],
  )

  if (result.rows.length === 0) {
    return null
  }

  return mapUserRow(result.rows[0])
}

export const createUser = async (input: CreateUserInput): Promise<UserRecord> => {
  const result = await query<UserRow>(
    `
    INSERT INTO users (auth_user_id, email, display_name)
    VALUES ($1, $2, $3)
    RETURNING
      id,
      auth_user_id,
      email,
      display_name,
      credit_balance,
      created_at,
      updated_at
    `,
    [input.authUserId, input.email ?? null, input.displayName ?? null],
  )

  return mapUserRow(result.rows[0])
}
