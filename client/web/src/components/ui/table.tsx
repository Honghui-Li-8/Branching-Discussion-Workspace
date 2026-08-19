import { cn } from '../../lib/utils'

// Plain semantic elements, no Radix primitive (Radix has none for tables).
// Only current signal is ModelMarkdown.tsx rendering markdown tables — that
// path styles its own output, so this is for any future first-party table
// (a settings or usage list), not a replacement for markdown rendering.
// Wrapper carries overflow-x-auto so a wide table scrolls itself rather than
// forcing horizontal scroll on the whole page.

export const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
)

export const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('border-b border-border-default', className)} {...props} />
)

export const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
)

export const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr
    className={cn('border-b border-border-default transition-colors hover:bg-bg-subtle', className)}
    {...props}
  />
)

export const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn('px-3 py-2 text-left text-xs font-medium text-text-muted', className)}
    {...props}
  />
)

export const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2 text-text-default', className)} {...props} />
)
