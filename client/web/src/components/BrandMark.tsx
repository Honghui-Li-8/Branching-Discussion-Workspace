import { Link } from './ui/link'
import { PATHS } from '../routePaths'
import { cn } from '../lib/utils'

/**
 * The product identity: mark plus wordmark, linking home. One component for
 * the public shell's dark header (A06) and the signed-in sidebar (A10), so
 * the two surfaces cannot drift apart. The mark is decorative beside the
 * wordmark; the link's accessible name is "Trellis".
 */
export const BrandMark = ({ tone, className }: { tone: 'dark' | 'light'; className?: string }) => (
  <Link
    to={PATHS.root}
    underline="hover"
    className={cn(
      'inline-flex items-center gap-2 text-label font-semibold no-underline',
      tone === 'dark'
        ? 'text-text-inverse hover:text-text-inverse focus-visible:ring-accent-wash'
        : 'text-text-default hover:text-text-default',
      className,
    )}
  >
    <img src="/favicon.svg" alt="" aria-hidden="true" width={28} height={28} className="size-7" />
    Trellis
  </Link>
)
