import { useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, Columns3 } from 'lucide-react' // not in A05b's icons.ts map — flagged
import { cn } from '../../lib/utils'
import { Button } from './button'
import { Input } from './form-field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

// From A04a's v9 gallery. Sorting / filtering / pagination / column
// visibility over our own table.tsx, driven by TanStack Table's headless
// hooks (it supplies state and row models, zero markup or styling).
//
// NEW dependency: @tanstack/react-table. Flagged, and it carries a real
// caveat v9 surfaced — see the React Compiler note in the trials page.
//
// Plausible Trellis fit named in v9: a branches/workspaces table.

export function DataTable<T>({
  columns,
  data,
  filterColumn,
  filterPlaceholder = 'Filter…',
  pageSize = 5,
  className,
}: {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  /** Column id to wire the search box to. Omit for no filter box. */
  filterColumn?: string
  filterPlaceholder?: string
  pageSize?: number
  className?: string
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = useState<{ id: string; value: unknown }[]>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: (updater) =>
      setColumnFilters((old) => (typeof updater === 'function' ? updater(old) : updater)),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })

  const filterValue = filterColumn
    ? ((table.getColumn(filterColumn)?.getFilterValue() as string) ?? '')
    : ''

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-2">
        {filterColumn && (
          <Input
            value={filterValue}
            onChange={(e) => table.getColumn(filterColumn)?.setFilterValue(e.target.value)}
            placeholder={filterPlaceholder}
            className="max-w-xs"
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="ml-auto">
              <Columns3 className="h-4 w-4" aria-hidden="true" /> Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((column) => (
                <DropdownMenuItem
                  key={column.id}
                  onSelect={(e) => {
                    e.preventDefault()
                    column.toggleVisibility(!column.getIsVisible())
                  }}
                  className="capitalize"
                >
                  <span
                    className={cn(
                      'h-3 w-3 shrink-0 rounded-sm border',
                      column.getIsVisible()
                        ? 'border-accent-default bg-accent-default'
                        : 'border-border-strong',
                    )}
                    aria-hidden="true"
                  />
                  {column.id}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border border-border-default">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 transition-colors hover:text-text-default"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-6 text-center text-text-muted">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-text-muted">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1} ·{' '}
          {table.getFilteredRowModel().rows.length} row(s)
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
