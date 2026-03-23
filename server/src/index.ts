import cors from 'cors'
import express from 'express'
import { TRPCError } from '@trpc/server'
import { createExpressMiddleware } from '@trpc/server/adapters/express'

import { appRouter } from './router.js'
import type { Request, Response } from 'express'
import type { AppRouterContext } from '@branching/shared'
import { getSessionIdFromCookieHeader } from './auth/cookies.js'
import { closePool, testConnection } from './db/client.js'
import { registerAuthRoutes } from './auth/routes.js'
import { getSessionUser, startSessionCleanup } from './auth/sessionStore.js'
import {
  createMessage as createMessageRecord,
  createNode as createNodeRecord,
  createWorkspace as createWorkspaceRecord,
  deleteMessage as deleteMessageRecord,
  deleteNode as deleteNodeRecord,
  deleteWorkspace as deleteWorkspaceRecord,
  getMessageById,
  getNodeById as getNodeByIdRecord,
  getUserById,
  getWorkspaceById as getWorkspaceByIdRecord,
  listMessagesForNode as listMessagesForNodeRecord,
  listNodesByWorkspace as listNodesByWorkspaceRecord,
  listUsers,
  listWorkspaces as listWorkspacesRecord,
  updateMessage as updateMessageRecord,
  updateNode as updateNodeRecord,
  updateWorkspace as updateWorkspaceRecord,
} from './db/index.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
)
app.use(express.json())
registerAuthRoutes(app)

const sessionCleanupTimer = startSessionCleanup()

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext({ req }): AppRouterContext {
      const sessionId = getSessionIdFromCookieHeader(req.headers.cookie)
      const sessionUserId = sessionId ? getSessionUser(sessionId)?.id ?? null : null

      const requireSessionUserId = (): string => {
        if (!sessionUserId) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
          })
        }
        return sessionUserId
      }

      const assertWorkspaceOwned = async (workspaceId: string) => {
        const currentUserId = requireSessionUserId()
        const workspace = await getWorkspaceByIdRecord(workspaceId)
        if (!workspace) {
          return null
        }
        if (workspace.authorUserId !== currentUserId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Workspace access is forbidden.',
          })
        }
        return workspace
      }

      const assertNodeOwned = async (nodeId: string) => {
        requireSessionUserId()
        const node = await getNodeByIdRecord(nodeId)
        if (!node) {
          return null
        }

        const workspace = await assertWorkspaceOwned(node.workspaceId)
        if (!workspace) {
          return null
        }

        return node
      }

      const assertMessageOwned = async (messageId: string) => {
        requireSessionUserId()
        const message = await getMessageById(messageId)
        if (!message) {
          return null
        }

        const node = await assertNodeOwned(message.nodeId)
        if (!node) {
          return null
        }

        return message
      }

      return {
        sessionUserId,
        listUsers: async () => {
          const currentUserId = requireSessionUserId()
          const currentUser = await getUserById(currentUserId)
          return currentUser ? [currentUser] : []
        },
        getUserById: async (id) => {
          const currentUserId = requireSessionUserId()
          if (id !== currentUserId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'User access is forbidden.',
            })
          }

          return getUserById(id)
        },
        createUser: async () => {
          requireSessionUserId()
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'User creation is managed by the auth flow.',
          })
        },
        listWorkspaces: async () => {
          const currentUserId = requireSessionUserId()
          const workspaces = await listWorkspacesRecord()
          return workspaces.filter((workspace) => workspace.authorUserId === currentUserId)
        },
        getWorkspaceById: async (id) => assertWorkspaceOwned(id),
        createWorkspace: async (input) => {
          const currentUserId = requireSessionUserId()
          return createWorkspaceRecord({
            ...input,
            authorUserId: currentUserId,
          })
        },
        updateWorkspace: async (input) => {
          const existingWorkspace = await assertWorkspaceOwned(input.id)
          if (!existingWorkspace) {
            return null
          }

          return updateWorkspaceRecord(input)
        },
        deleteWorkspace: async (id) => {
          const existingWorkspace = await assertWorkspaceOwned(id)
          if (!existingWorkspace) {
            return null
          }

          return deleteWorkspaceRecord(id)
        },
        listNodesByWorkspace: async (workspaceId) => {
          const workspace = await assertWorkspaceOwned(workspaceId)
          if (!workspace) {
            return []
          }

          return listNodesByWorkspaceRecord(workspaceId)
        },
        getNodeById: async (id) => assertNodeOwned(id),
        createNode: async (input) => {
          const currentUserId = requireSessionUserId()
          const workspace = await assertWorkspaceOwned(input.workspaceId)
          if (!workspace) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Workspace not found.',
            })
          }

          return createNodeRecord({
            ...input,
            authorUserId: currentUserId,
          })
        },
        updateNode: async (input) => {
          const existingNode = await assertNodeOwned(input.id)
          if (!existingNode) {
            return null
          }

          return updateNodeRecord(input)
        },
        deleteNode: async (id) => {
          const existingNode = await assertNodeOwned(id)
          if (!existingNode) {
            return null
          }

          return deleteNodeRecord(id)
        },
        listMessagesForNode: async (nodeId) => {
          const node = await assertNodeOwned(nodeId)
          if (!node) {
            return []
          }

          return listMessagesForNodeRecord(nodeId)
        },
        createMessage: async (input) => {
          const currentUserId = requireSessionUserId()
          const node = await assertNodeOwned(input.nodeId)
          if (!node) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Node not found.',
            })
          }

          return createMessageRecord({
            ...input,
            authorUserId: currentUserId,
          })
        },
        updateMessage: async (input) => {
          const existingMessage = await assertMessageOwned(input.id)
          if (!existingMessage) {
            return null
          }

          return updateMessageRecord(input)
        },
        deleteMessage: async (id) => {
          const existingMessage = await assertMessageOwned(id)
          if (!existingMessage) {
            return null
          }

          return deleteMessageRecord(id)
        },
      }
    },
  }),
)

app.get('/health', async (_req: Request, res: Response) => {
  const dbConnected = await testConnection()
  res.json({ status: 'ok', service: 'server', dbConnected })
})

app.get('/', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from Node backend' })
})

const server = app.listen(PORT, async () => {
  const dbConnected = await testConnection()
  if (!dbConnected) {
    console.error('Database not reachable. Make sure DATABASE_URL is set and migrations are applied.')
    process.exit(1)
  }
  console.log(`Server running on http://localhost:${PORT}`)
})

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} received. Shutting down...`)
  clearInterval(sessionCleanupTimer)
  server.close(async () => {
    await closePool()
    process.exit(0)
  })
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM')
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
})

process.on('SIGINT', () => {
  shutdown('SIGINT')
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
})
