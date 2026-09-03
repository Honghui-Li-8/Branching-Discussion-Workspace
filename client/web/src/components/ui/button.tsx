import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Spinner } from './skeleton'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent-default text-white hover:bg-accent-hover active:bg-accent-active',
        secondary:
          'border border-border-strong bg-bg-default text-text-default hover:bg-bg-subtle active:bg-bg-muted',
        ghost: 'text-text-default hover:bg-bg-subtle active:bg-bg-muted',
        // Owner-settled destructive treatment (option B from the trials):
        // real darker steps, now available as error-hover/error-active
        // tokens rather than the raw Tailwind red-700/800 hexes the trial
        // carried. The flat and CSS-filter comparison variants died with
        // the decision.
        destructive: 'bg-error-default text-white hover:bg-error-hover active:bg-error-active',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-10 px-5',
      },
      pending: {
        true: 'relative cursor-wait',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      pending: false,
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, pending, disabled, children, ...props }, ref) => {
    const isPending = pending === true
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, pending, className }))}
        disabled={disabled || isPending}
        aria-busy={isPending || undefined}
        {...props}
      >
        {/* Original label stays in the DOM (invisible, not display:none) so
            the button's own width is always driven by the idle-state
            content — pending never changes the button's size, regardless
            of how much shorter/longer the idle label is. */}
        <span className={cn('inline-flex items-center gap-2', isPending && 'invisible')}>
          {children}
        </span>
        {isPending && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner tone="current" />
          </span>
        )}
      </button>
    )
  },
)
Button.displayName = 'Button'
