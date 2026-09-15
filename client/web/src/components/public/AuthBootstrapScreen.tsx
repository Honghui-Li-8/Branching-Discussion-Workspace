// A06: moved out of App.tsx. The neutral branded state shown while
// `GET /auth/me` resolves — neither the landing nor the workspace may flash
// before sign-in status is known. Restyled into the shell in Commit 4.
export const AuthBootstrapScreen = () => {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 text-sm text-slate-500">
      Checking sign-in...
    </main>
  )
}
