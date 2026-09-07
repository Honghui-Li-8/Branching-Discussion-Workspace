import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cloneElement, forwardRef, isValidElement } from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '../../lib/utils'

// Typography note: A05a's Step 5 audit flagged that no app-specific type
// scale existed, and left these on Tailwind's raw text-sm/text-xs as a v1
// stand-in. A-T3a supplied the scale, so they now use the semantic roles
// (text-label / text-caption) — identical rendered size, named by the job
// they do rather than by how big they are.

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn('text-label font-medium text-text-default', className)}
      {...props}
    />
  ),
)
Label.displayName = 'Label'

const fieldBase =
  'w-full rounded-md border border-border-default bg-bg-default px-3 py-2 text-label text-text-default placeholder:text-text-muted outline-none transition-colors focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error-default aria-invalid:focus-visible:ring-error-default'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, 'min-h-[80px] resize-y', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

export function ValidationMessage({
  children,
  id,
  tone = 'error',
}: {
  children: React.ReactNode
  id?: string
  tone?: 'error'
}) {
  void tone
  return (
    <p id={id} className="mt-1 text-caption text-error-default" role="alert">
      {children}
    </p>
  )
}

export function FormField({
  id,
  label,
  children,
  error,
}: {
  id: string
  label: string
  children: React.ReactElement
  error?: string
}) {
  // Wire aria-invalid + aria-describedby onto the control automatically
  // rather than leaving it to each call site. Without this, an invalid field
  // announces "invalid" but never says *why* — the error text is visually
  // adjacent but not programmatically associated. Verified live: this was a
  // real gap here (aria-describedby came back null on a failing field),
  // which is the same class of finding A04a's axe audit hit in its own
  // hand-written demos. Fixing it in the primitive means every future
  // consumer inherits the wiring instead of having to remember it.
  const errorId = error ? `${id}-error` : undefined
  const control =
    isValidElement(children) && errorId
      ? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          'aria-invalid': true,
          'aria-describedby':
            [errorId, (children.props as Record<string, unknown>)['aria-describedby']]
              .filter(Boolean)
              .join(' ') || undefined,
        })
      : children

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {error && <ValidationMessage id={errorId}>{error}</ValidationMessage>}
    </div>
  )
}
