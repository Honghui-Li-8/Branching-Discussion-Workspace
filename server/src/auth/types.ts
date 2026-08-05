export type SessionUser = {
  id: string
  authUserId: string
  email: string | null
  displayName: string | null
}

export type SessionRecord = {
  user: SessionUser
  expiresAt: number
}

export type LoginRequestBody = {
  token?: unknown
  provider?: unknown
}

export type VerifiedExternalIdentity = {
  provider: string
  externalUserId: string
  email: string | null
  displayName: string | null
}
