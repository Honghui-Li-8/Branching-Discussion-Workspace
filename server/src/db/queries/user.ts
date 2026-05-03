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

export const getUserByAuthUserId = async (authUserId: string): Promise<UserRecord | null> => {
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
    WHERE auth_user_id = $1
    `,
    [authUserId],
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

export const getCreditBalance = async (userId: string): Promise<number> => {
  const result = await query<{ credit_balance: string }>(
    'SELECT credit_balance FROM users WHERE id = $1',
    [userId],
  )
  return result.rows.length > 0 ? Number(result.rows[0].credit_balance) : 0
}

export const insertCreditTransaction = async (input: {
  userId: string
  amount: number
  type: 'grant' | 'usage' | 'refund' | 'adjustment'
  reason: string | null
}): Promise<void> => {
  await query(
    `INSERT INTO credit_transactions (user_id, amount, type, reason)
     VALUES ($1, $2, $3, $4)`,
    [input.userId, input.amount, input.type, input.reason],
  )
}

export const getOrCreateUserByAuthIdentity = async (
  input: CreateUserInput,
): Promise<UserRecord> => {
  const result = await query<UserRow>(
    `
    INSERT INTO users (auth_user_id, email, display_name)
    VALUES ($1, $2, $3)
    ON CONFLICT (auth_user_id) DO UPDATE
    SET
      email = COALESCE(users.email, EXCLUDED.email),
      display_name = COALESCE(users.display_name, EXCLUDED.display_name)
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
