import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { Check } from 'lucide-react' // not in A05b's icons.ts map — flagged
import { cn } from '../../lib/utils'

// Grouped in one file rather than five: these are all small binary/choice
// controls sharing the same focus-ring and accent treatment, and none of
// them has a confirmed consumer in the app yet (only ConversationComposer
// showed any signal). Keeping them together avoids five near-identical
// 30-line files for what may end up being unused primitives; they can be
// split out individually if any one grows real variants.

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2'

export function Checkbox({ className, ...props }: CheckboxPrimitive.CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-bg-default',
        'data-[state=checked]:border-accent-default data-[state=checked]:bg-accent-default data-[state=checked]:text-white',
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="h-3 w-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
        'bg-bg-muted data-[state=checked]:bg-accent-default',
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-bg-default shadow-sm transition-transform',
          'translate-x-0 data-[state=checked]:translate-x-4',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export const RadioGroup = ({ className, ...props }: RadioGroupPrimitive.RadioGroupProps) => (
  <RadioGroupPrimitive.Root className={cn('grid gap-2', className)} {...props} />
)

export function RadioGroupItem({ className, ...props }: RadioGroupPrimitive.RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-bg-default',
        'data-[state=checked]:border-accent-default',
        'disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="h-2 w-2 rounded-full bg-accent-default" />
    </RadioGroupPrimitive.Item>
  )
}

const toggleBase = cn(
  'inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-label font-medium transition-colors',
  'text-text-secondary hover:bg-bg-subtle',
  'data-[state=on]:bg-accent-tint data-[state=on]:text-accent-active',
  'disabled:pointer-events-none disabled:opacity-50',
  focusRing,
)

export const Toggle = ({ className, ...props }: TogglePrimitive.ToggleProps) => (
  <TogglePrimitive.Root className={cn(toggleBase, className)} {...props} />
)

// Radix types ToggleGroup's root as a discriminated union on `type`
// ('single' | 'multiple') rather than one flat props type, so this takes the
// component's own props type instead of a non-existent ToggleGroupProps.
export const ToggleGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) => (
  <ToggleGroupPrimitive.Root
    className={cn('inline-flex gap-1 rounded-md border border-border-default p-1', className)}
    {...props}
  />
)

export const ToggleGroupItem = ({ className, ...props }: ToggleGroupPrimitive.ToggleGroupItemProps) => (
  <ToggleGroupPrimitive.Item className={cn(toggleBase, className)} {...props} />
)
