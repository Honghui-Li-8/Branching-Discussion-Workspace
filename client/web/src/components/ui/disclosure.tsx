import * as AccordionPrimitive from '@radix-ui/react-accordion'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { ChevronDown } from 'lucide-react' // not in A05b's map for this use — flagged
import { cn } from '../../lib/utils'

// Accordion / Collapsible / Tabs grouped: all three are show-hide-region
// controls with the same border and accent treatment.
//
// IMPORTANT verdict note from A04a: MUI was preferred over Radix for BOTH
// Tabs and Accordion (2 of the only 3 categories MUI won outright, the third
// being Tooltip). These Radix versions are built here for completeness and
// consistency with the rest of the set, but that verdict stands unrefuted —
// worth a deliberate look before adopting either in a real surface.

export const Accordion = AccordionPrimitive.Root

export const AccordionItem = ({ className, ...props }: AccordionPrimitive.AccordionItemProps) => (
  <AccordionPrimitive.Item className={cn('border-b border-border-default', className)} {...props} />
)

export function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          'flex flex-1 items-center justify-between gap-2 py-3 text-label font-medium text-text-default',
          'transition-colors hover:text-accent-hover',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2',
          '[&[data-state=open]>svg]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export const AccordionContent = ({ className, ...props }: AccordionPrimitive.AccordionContentProps) => (
  <AccordionPrimitive.Content
    className={cn('overflow-hidden pb-3 text-label text-text-secondary', className)}
    {...props}
  />
)

export const Collapsible = CollapsiblePrimitive.Root
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger
export const CollapsibleContent = CollapsiblePrimitive.Content

export const Tabs = TabsPrimitive.Root

export const TabsList = ({ className, ...props }: TabsPrimitive.TabsListProps) => (
  <TabsPrimitive.List
    className={cn('inline-flex items-center gap-1 border-b border-border-default', className)}
    {...props}
  />
)

export const TabsTrigger = ({ className, ...props }: TabsPrimitive.TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    className={cn(
      'border-b-2 border-transparent px-3 py-2 text-label font-medium text-text-secondary transition-colors',
      'hover:text-text-default',
      'data-[state=active]:border-accent-default data-[state=active]:text-accent-active',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
)

export const TabsContent = ({ className, ...props }: TabsPrimitive.TabsContentProps) => (
  <TabsPrimitive.Content className={cn('pt-3 text-label text-text-secondary', className)} {...props} />
)
