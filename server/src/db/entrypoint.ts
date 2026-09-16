import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * True when the module at `moduleUrl` is the process entrypoint — `tsx file.ts`,
 * `node --import tsx file.ts`, or the yarn scripts that wrap them.
 *
 * The db CLI modules (`migrate.ts`, `seed.ts`, `reset.ts`) export functions that
 * other modules import, so their top-level `main()` must run only when the file
 * itself was launched. A suffix match on `process.argv[1]` is not enough: the
 * separator differs on Windows, and a symlink or a renamed launcher would make
 * the CLI exit 0 without doing anything. Both sides are resolved through
 * `realpathSync` because Node resolves `argv[1]` but does not follow symlinks,
 * while ESM resolves `import.meta.url` through them.
 *
 * Any failure to resolve (no `argv[1]`, a path that does not exist) returns
 * `false`: the safe answer is "do not run the CLI", never "throw at import".
 */
export const isEntrypoint = (
  moduleUrl: string,
  argv1: string | undefined = process.argv[1],
): boolean => {
  if (!argv1) return false
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl))
  } catch {
    return false
  }
}
