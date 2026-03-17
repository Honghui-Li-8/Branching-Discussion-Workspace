export interface UserRecord {
  id: string
  authUserId: string
  email: string | null
  displayName: string | null
  creditBalance: number
  createdAt: string
  updatedAt: string
}

export interface CreateUserInput {
  authUserId: string
  email?: string | null
  displayName?: string | null
}
