import { useState } from 'react'
import { trpc } from '../trpc'

/** Refetches the workspace list after a failed load; `isRetrying` covers the request. */
export const useRetryWorkspaces = () => {
  const utils = trpc.useUtils()
  const [isRetrying, setIsRetrying] = useState(false)

  const retry = async () => {
    setIsRetrying(true)
    try {
      await utils.workspacesList.refetch()
    } finally {
      setIsRetrying(false)
    }
  }

  return { retry, isRetrying }
}
