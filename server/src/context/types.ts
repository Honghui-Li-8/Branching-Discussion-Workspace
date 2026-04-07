import type { AppRouterContext } from '@branching/shared'

export type ExistsById = (id: string) => Promise<boolean>
export type RequireSessionUserId = () => string

export type ResolveOwnedRecordOrNull = <T>(
  record: T | null,
  resourceId: string,
  existsById: ExistsById,
) => Promise<T | null>

export type ResolveOwnedRecordOrNotFound = <T>(
  record: T | null,
  resourceId: string,
  existsById: ExistsById,
  notFoundMessage: string,
) => Promise<T>

export type ContextOwnershipHelpers = {
  requireSessionUserId: RequireSessionUserId
  resolveOwnedRecordOrNull: ResolveOwnedRecordOrNull
  resolveOwnedRecordOrNotFound: ResolveOwnedRecordOrNotFound
  getWorkspaceByIdForSessionUser: (
    workspaceId: string,
  ) => ReturnType<AppRouterContext['getWorkspaceById']>
  getNodeByIdForSessionUser: (nodeId: string) => ReturnType<AppRouterContext['getNodeById']>
  throwNotFound: (message: string) => never
}
