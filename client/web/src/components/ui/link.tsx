import type { AnchorHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  underline?: 'always' | 'hover'
}

export function Link({ className, underline = 'hover', ...props }: LinkProps) {
  return (
    <a
      className={cn(
        'text-text-link outline-none transition-colors hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2 rounded-sm',
        underline === 'always' ? 'underline' : 'no-underline hover:underline',
        className,
      )}
      {...props}
    />
  )
}
