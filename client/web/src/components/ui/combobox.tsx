import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react' // not in A05b's icons.ts map — flagged
import { cn } from '../../lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'

// From A04a's v9 gallery. A searchable select, composed from Popover +
// Command — both of which we already have, so this adds NO new dependency.
// That's what makes it the cheapest of v9's three: it's a composition, not
// a library.
//
// Plausible Trellis fit named in v9: a searchable merge-target picker
// (choosing which node to merge into, when there are more than a handful).
// Note we deliberately dropped plain Select earlier — this is the different,
// keyboard-searchable case, not a re-add of that.

export type ComboboxOption = { value: string; label: string }

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No match found.',
  className,
}: {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border-default bg-bg-default px-3 text-label',
            selected ? 'text-text-default' : 'text-text-muted',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-default focus-visible:ring-offset-2',
            className,
          )}
        >
          {selected?.label ?? placeholder}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange?.(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                  {option.value === value && (
                    <Check className="ml-auto h-3.5 w-3.5 text-accent-default" aria-hidden="true" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
