type WorkspaceLike = { id: string; title: string; summary?: string | null; updatedAt?: string }

/**
 * The shape the shell keeps in the store for the sidebar list. Shared by the
 * workspace sync (query → store) and the create hook (A10), which writes the
 * fresh list to the store itself before selecting the new workspace.
 */
export const toWorkspaceNavItems = (data: ReadonlyArray<WorkspaceLike>) =>
  data.map((workspace) => ({
    id: workspace.id,
    title: workspace.title,
    summary: workspace.summary ?? null,
    updatedAt: workspace.updatedAt ?? null,
  }))
