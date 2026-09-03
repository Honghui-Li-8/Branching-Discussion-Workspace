import { ChevronRight, MoreHorizontal } from 'lucide-react' // ChevronRight is in A05b's nav pair; MoreHorizontal is its overflow icon
import { cn } from '../../lib/utils'

// Breadcrumb + Pagination, grouped. Both are plain semantic markup (no Radix
// primitive exists for either) and both are the weakest-signal items in this
// batch — nothing in the app needs them today. Built for completeness of the
// set, explicitly flagged as speculative.
//
// Breadcrumb note: A03 adopted a "folder path"-style outline nav (Option B,
// progress log 14), which is conceptually adjacent — if that ever gets a
// path header, this is the primitive it would use.
//
// NavigationMenu and Command (⌘K palette) are deliberately NOT included:
// NavigationMenu is a large primitive with zero signal, and Command is a
// product-feature decision (needs the cmdk dependency), not a missing
// primitive. Flagged rather than silently skipped.

export const Breadcrumb = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav aria-label="Breadcrumb" className={cn('text-label', className)} {...props} />
)

export const BreadcrumbList = ({ className, ...props }: React.ComponentProps<'ol'>) => (
  <ol className={cn('flex flex-wrap items-center gap-1.5 text-text-muted', className)} {...props} />
)

export const BreadcrumbItem = ({ className, ...props }: React.ComponentProps<'li'>) => (
  <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />
)

export const BreadcrumbLink = ({ className, ...props }: React.ComponentProps<'a'>) => (
  <a
    className={cn(
      'transition-colors hover:text-accent-default',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default',
      className,
    )}
    {...props}
  />
)

export const BreadcrumbPage = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span aria-current="page" className={cn('font-medium text-text-default', className)} {...props} />
)

export const BreadcrumbSeparator = ({ className, ...props }: React.ComponentProps<'li'>) => (
  <li role="presentation" aria-hidden="true" className={cn('text-text-disabled', className)} {...props}>
    <ChevronRight className="h-3.5 w-3.5" />
  </li>
)

export const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span role="presentation" aria-hidden="true" className={cn('text-text-disabled', className)} {...props}>
    <MoreHorizontal className="h-4 w-4" />
  </span>
)

export const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav aria-label="Pagination" className={cn('flex items-center gap-1', className)} {...props} />
)

export function PaginationItem({
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-label transition-colors',
        active
          ? 'bg-accent-tint font-medium text-accent-active'
          : 'text-text-secondary hover:bg-bg-subtle',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
