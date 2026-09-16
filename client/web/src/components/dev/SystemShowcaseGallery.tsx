import { useId, useLayoutEffect, useState, type ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '../ui/button'
import { Link } from '../ui/link'
import { Cluster, Container, Stack, type SpaceStep } from '../ui/layout'
import { FormField, Input, Textarea } from '../ui/form-field'
import { Separator } from '../ui/separator'
import { Skeleton, Spinner } from '../ui/skeleton'
import { Badge, type BadgeStatus } from '../ui/badge'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '../ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { AppTooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card'
import { ScrollArea } from '../ui/scroll-area'
import { AlertBanner } from '../ui/alert-banner'
import { AlertPopupProvider, useAlertPopup } from '../ui/alert-popup'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu'
import { Checkbox, RadioGroup, RadioGroupItem, Switch, ToggleGroup, ToggleGroupItem } from '../ui/toggles'
import { Progress } from '../ui/progress'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/disclosure'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Pagination,
  PaginationItem,
} from '../ui/navigation'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../ui/command'
import { Combobox } from '../ui/combobox'
import { DataTable } from '../ui/data-table'
import { ICONS } from '../../lib/icons'
import { PATHS } from '../../routePaths'

/* ────────────────────────────────────────────────────────────────────────
   A-T3d — System showcase gallery: the owner's review-and-approval surface
   for the A-T3 foundation (a: type roles, b: sizing convention, c: layout
   primitives + normalization, e: responsive/a11y conventions).

   Everything here imports the shipped files. Resolved token values are read
   from the live stylesheet at mount, never re-declared — a gallery showing
   hand-written approximations proves nothing about what shipped.

   Dev-only: registered in routes.tsx behind `isDev`, never linked from
   product navigation. The other half of this gate is the real public shell
   (A06): the links at the top go there.

   Gaps are flagged, not smoothed over — see the "Known gaps" section.
   ──────────────────────────────────────────────────────────────────────── */

/* ADR-0001 — the six type roles. Class + token name only; sizes are read live. */
const TYPE_ROLES = [
  { role: 'display', cls: 'text-display', use: 'Landing hero — once per page' },
  { role: 'title', cls: 'text-title', use: 'Page and panel titles' },
  { role: 'heading', cls: 'text-heading', use: 'Section headings within a surface' },
  { role: 'body', cls: 'text-body', use: 'Prose and message content' },
  { role: 'label', cls: 'text-label', use: 'Buttons, menu items, form labels' },
  { role: 'caption', cls: 'text-caption', use: 'Timestamps, metadata, helper text' },
] as const

/* ADR-0002 — Figma's 19 `space/*` values, each already a step on Tailwind's
   4px grid. Literal class strings so the scanner emits them. */
const SPACING_STEPS = [
  { px: 2, step: '0.5', cls: 'w-0.5' },
  { px: 3, step: '0.75', cls: 'w-0.75' },
  { px: 4, step: '1', cls: 'w-1' },
  { px: 5, step: '1.25', cls: 'w-1.25' },
  { px: 6, step: '1.5', cls: 'w-1.5' },
  { px: 8, step: '2', cls: 'w-2' },
  { px: 9, step: '2.25', cls: 'w-2.25' },
  { px: 10, step: '2.5', cls: 'w-2.5' },
  { px: 12, step: '3', cls: 'w-3' },
  { px: 14, step: '3.5', cls: 'w-3.5' },
  { px: 16, step: '4', cls: 'w-4' },
  { px: 20, step: '5', cls: 'w-5' },
  { px: 24, step: '6', cls: 'w-6' },
  { px: 28, step: '7', cls: 'w-7' },
  { px: 32, step: '8', cls: 'w-8' },
  { px: 40, step: '10', cls: 'w-10' },
  { px: 48, step: '12', cls: 'w-12' },
  { px: 64, step: '16', cls: 'w-16' },
  { px: 96, step: '24', cls: 'w-24' },
] as const

const GAP_STEPS: SpaceStep[] = ['1', '2', '3', '4', '6', '8', '12']

/* ADR-0003 — a sweep of container widths. max-* is a constraint, not a pin. */
const CONTAINER_SWEEP = [
  { label: '16rem', cls: 'max-w-[16rem]' },
  { label: '24rem', cls: 'max-w-[24rem]' },
  { label: '36rem', cls: 'max-w-[36rem]' },
  { label: '48rem', cls: 'max-w-[48rem]' },
  { label: 'full', cls: 'max-w-none' },
] as const

const ALL_STATUSES: BadgeStatus[] = [
  'exploring', 'selected', 'merged', 'success', 'warning',
  'info', 'pending', 'folded', 'read-only', 'error',
]

type WorkspaceRow = { workspace: string; branches: number; status: BadgeStatus }
const TABLE_ROWS: WorkspaceRow[] = [
  { workspace: 'Database selection', branches: 4, status: 'merged' },
  { workspace: 'Project decision', branches: 2, status: 'exploring' },
  { workspace: 'API design', branches: 3, status: 'pending' },
  { workspace: 'Naming', branches: 1, status: 'read-only' },
  { workspace: 'Auth flow', branches: 5, status: 'success' },
  { workspace: 'Schema v2', branches: 2, status: 'warning' },
]
const TABLE_COLUMNS: ColumnDef<WorkspaceRow, unknown>[] = [
  { accessorKey: 'workspace', header: 'Workspace' },
  { accessorKey: 'branches', header: 'Branches' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <Badge status={getValue() as BadgeStatus}>{String(getValue())}</Badge>,
  },
]
const COMBO_OPTIONS = [
  { value: 'db', label: 'Database selection' },
  { value: 'proj', label: 'Project decision' },
  { value: 'api', label: 'API design' },
  { value: 'auth', label: 'Auth flow' },
]

function Section({
  id,
  title,
  note,
  level = 2,
  children,
}: {
  id: string
  title: string
  note?: string
  /** Heading level: sections nested inside another Section pass 3 so the outline stays a tree (A-T3e §4). */
  level?: 2 | 3
  children: ReactNode
}) {
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <Stack as="section" id={id} aria-labelledby={`${id}-heading`} gap="4" className="rounded-lg border border-border-default bg-bg-subtle p-5">
      <div>
        <Heading id={`${id}-heading`} className="text-heading font-medium text-text-default">{title}</Heading>
        {note ? <p className="mt-1 max-w-prose text-caption text-text-muted">{note}</p> : null}
      </div>
      {children}
    </Stack>
  )
}

/** Reads custom properties' resolved values from the live stylesheet, once. */
const readResolvedTokens = (names: readonly string[]) => {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(names.map((n) => [n, cs.getPropertyValue(n).trim() || '(unset)']))
}

/** Rendered font-size and line-height of each specimen, as the browser laid it out. */
const readRendered = () =>
  Object.fromEntries(
    [...document.querySelectorAll<HTMLElement>('[data-type-role]')].map((el) => {
      const cs = getComputedStyle(el)
      return [el.dataset.typeRole ?? '', `${cs.fontSize} / ${cs.lineHeight}`]
    }),
  )

const TYPE_TOKEN_NAMES = TYPE_ROLES.flatMap((r) => [`--text-${r.role}`, `--text-${r.role}--line-height`])

function TypeScale() {
  const [tokens] = useState(() => readResolvedTokens(TYPE_TOKEN_NAMES))
  // Rendered values need the specimens in the DOM; a layout effect after the
  // first paint reads them once. setState here is deliberate and terminal.
  const [rendered, setRendered] = useState<Record<string, string>>({})
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot DOM measurement of the specimens
    setRendered(readRendered())
  }, [])
  return (
    <Stack gap="6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Specimen</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Line height</TableHead>
            <TableHead>Rendered</TableHead>
            <TableHead>Use</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {TYPE_ROLES.map((r) => (
            <TableRow key={r.role}>
              <TableCell><code className="font-mono text-caption">{r.cls}</code></TableCell>
              <TableCell><span data-type-role={r.role} className={`${r.cls} text-text-default`}>Branch every idea</span></TableCell>
              <TableCell><code className="font-mono text-caption">{tokens[`--text-${r.role}`]}</code></TableCell>
              <TableCell><code className="font-mono text-caption">{tokens[`--text-${r.role}--line-height`]}</code></TableCell>
              <TableCell><code className="font-mono text-caption">{rendered[r.role] ?? '…'}</code></TableCell>
              <TableCell className="text-caption text-text-muted">{r.use}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Stack as="article" gap="3" className="max-w-prose rounded-md border border-border-default bg-bg-default p-6" aria-label="Prose specimen">
        <p className="text-caption font-semibold uppercase tracking-wide text-text-muted">Prose specimen</p>
        <p className="text-display font-semibold text-text-default">Branch every idea. Merge only what works.</p>
        <p className="text-title font-medium text-text-default">How a branch comes back</p>
        <p className="text-body text-text-secondary">
          Trellis is a branching workspace for AI conversations. Explore multiple directions in
          parallel, then approve and merge back only what works into the main thread. The scale
          is built to standard rather than derived from current usage, so this paragraph is where
          the roles are judged in use — not as a ladder.
        </p>
        <p className="text-heading font-medium text-text-default">What you can do</p>
        <p className="text-body text-text-secondary">
          Compare branches side by side, then approve and merge back only the responses that move
          you forward. Explore multiple directions from any point in the conversation without
          losing the original thread.
        </p>
        <Cluster gap="3">
          <Button size="sm">Label on a button</Button>
          <span className="text-caption text-text-muted">Updated 2 days ago · caption</span>
        </Cluster>
      </Stack>
    </Stack>
  )
}

function SpacingScale() {
  return (
    <Stack gap="2">
      {SPACING_STEPS.map((s) => (
        <Cluster key={s.px} gap="4" align="center">
          <code className="w-16 font-mono text-caption text-text-muted">{s.px}px</code>
          <div className={`h-3 ${s.cls} rounded-sm bg-accent-default`} aria-hidden="true" />
          <code className="font-mono text-caption text-text-secondary">p-{s.step} · gap-{s.step} · w-{s.step}</code>
        </Cluster>
      ))}
    </Stack>
  )
}

function LayoutPrimitives() {
  return (
    <Stack gap="6">
      <div>
        <p className="mb-2 text-label font-medium text-text-default">Stack — gap steps</p>
        <Cluster gap="6" align="start">
          {GAP_STEPS.map((g) => (
            <Stack key={g} gap={g} className="rounded-md border border-dashed border-border-strong p-2">
              <code className="font-mono text-caption text-text-muted">gap-{g}</code>
              <div className="h-3 w-12 rounded-sm bg-accent-wash" />
              <div className="h-3 w-12 rounded-sm bg-accent-wash" />
            </Stack>
          ))}
        </Cluster>
      </div>
      <div>
        <p className="mb-2 text-label font-medium text-text-default">Cluster — wraps, justifies</p>
        <Cluster gap="3" justify="between" className="rounded-md border border-dashed border-border-strong p-3">
          <Cluster gap="2">
            {ALL_STATUSES.slice(0, 5).map((s) => <Badge key={s} status={s}>{s}</Badge>)}
          </Cluster>
          <Button size="sm" variant="secondary">Action</Button>
        </Cluster>
      </div>
      <div>
        <p className="mb-2 text-label font-medium text-text-default">Container — page / prose / narrow, composing real content</p>
        <Stack gap="3" className="rounded-md border border-dashed border-border-strong bg-bg-default py-4">
          <Container className="rounded-sm bg-accent-tint py-2 text-caption text-accent-strong">page · max-w-6xl — the public shell column</Container>
          <Container width="prose" className="rounded-sm bg-accent-tint py-2 text-caption text-accent-strong">prose · 65ch — a body-copy measure</Container>
          <Container width="narrow" className="rounded-sm bg-accent-tint py-2 text-caption text-accent-strong">narrow · 45ch — the login card, empty states</Container>
        </Stack>
      </div>
    </Stack>
  )
}

/** The composition swept across container widths: a real card, not a box. */
function SweptCard() {
  // Rendered once per sweep width; ids must be unique per instance or every
  // label resolves to the first card's input.
  const id = useId()
  return (
    <Stack gap="4" className="rounded-lg border border-border-default bg-bg-default p-4">
      <Cluster justify="between" gap="3">
        <p className="m-0 text-title font-medium text-text-default">Database selection</p>
        <Badge status="exploring">exploring</Badge>
      </Cluster>
      <AlertBanner tone="warning" title="12 commits behind">This branch has not merged in a while.</AlertBanner>
      <FormField id={id} label="Workspace name">
        <Input id={id} defaultValue="Database selection" />
      </FormField>
      <Cluster gap="2" justify="end">
        <Button variant="secondary" size="sm">Cancel</Button>
        <Button size="sm">Approve and merge</Button>
      </Cluster>
    </Stack>
  )
}

function ConventionExamples() {
  return (
    <Stack gap="8">
      <div>
        <p className="mb-1 text-label font-medium text-text-default">Stepped, not fluid (ADR-0003)</p>
        <p className="mb-3 max-w-prose text-caption text-text-muted">
          Type roles are fixed steps that change at breakpoints, never `clamp()` on viewport units. Where a fluid
          value is ever justified, its preferred term keeps a `rem` so the user's font-size setting still scales it.
          Resize the window: the left heading steps, the right one glides.
        </p>
        <Cluster gap="6" align="start">
          <Stack gap="1" className="rounded-md border border-border-default bg-bg-default p-4">
            <code className="font-mono text-caption text-text-muted">text-title lg:text-display</code>
            <p className="text-title font-semibold text-text-default lg:text-display">Stepped at lg</p>
          </Stack>
          <Stack gap="1" className="rounded-md border border-border-default bg-bg-default p-4">
            <code className="font-mono text-caption text-text-muted">clamp(1.25rem, 1rem + 1.5vw, 1.875rem)</code>
            <p className="font-semibold text-text-default" style={{ fontSize: 'clamp(1.25rem, 1rem + 1.5vw, 1.875rem)' }}>
              Fluid, rem-anchored
            </p>
          </Stack>
        </Cluster>
      </div>

      <div>
        <p className="mb-1 text-label font-medium text-text-default">One component across a sweep of container widths (ADR-0003)</p>
        <p className="mb-3 max-w-prose text-caption text-text-muted">
          The same card, constrained by max-width only. Nothing inside pins its own size, so each column is the
          component adapting to the space it is given — the property container queries will later rely on.
        </p>
        <Stack gap="4">
          {CONTAINER_SWEEP.map((c) => (
            <div key={c.label}>
              <code className="mb-1 block font-mono text-caption text-text-muted">{c.cls}</code>
              <div className={`w-full ${c.cls}`}><SweptCard /></div>
            </div>
          ))}
        </Stack>
      </div>
    </Stack>
  )
}

function PopupDemo() {
  const { show } = useAlertPopup()
  return (
    <Cluster gap="2">
      <Button variant="secondary" onClick={() => show({ tone: 'success', title: 'Success', description: 'Branch merged successfully.' })}>
        Success popup
      </Button>
      <Button variant="secondary" onClick={() => show({ tone: 'error', title: 'Error', description: 'Merge failed — try again.', duration: null })}>
        Persistent error
      </Button>
      <Button variant="secondary" onClick={() => show({ tone: 'info', description: 'Compact, no title.' })}>
        Compact info
      </Button>
    </Cluster>
  )
}

function Components() {
  const [pending, setPending] = useState(false)
  const [combo, setCombo] = useState<string>()
  const simulatePending = () => {
    setPending(true)
    window.setTimeout(() => setPending(false), 1500)
  }

  return (
    <Stack gap="6">
      <Section id="c-button" level={3} title="Button" note="primary / secondary / ghost / destructive · three sizes · disabled and width-stable pending.">
        <Cluster gap="3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete workspace</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" pending={pending} onClick={simulatePending}>Click to simulate pending</Button>
        </Cluster>
      </Section>

      <Section id="c-link" level={3} title="Link" note="Three render paths (A06): internal route, section anchor, external. Hover-underline for interactive contexts; always-underline for prose.">
        <Cluster gap="4">
          <Link to={PATHS.login}>Internal route</Link>
          <Link to="/#features">Section anchor</Link>
          <Link href="https://github.com/Honghui-Li-8/Branching-Discussion-Workspace" target="_blank">External, new tab</Link>
          <Link to={PATHS.root} underline="always">Always-underlined</Link>
        </Cluster>
      </Section>

      <Section id="c-form" level={3} title="Form — field, input, textarea, validation, combobox, toggles">
        <Stack gap="4" className="max-w-md">
          <FormField id="g-name" label="Workspace name">
            <Input id="g-name" placeholder="e.g. Database selection" />
          </FormField>
          <FormField id="g-desc" label="Description">
            <Textarea id="g-desc" placeholder="What is this workspace about?" />
          </FormField>
          <FormField id="g-invalid" label="Required field" error="This field is required.">
            <Input id="g-invalid" aria-invalid defaultValue="" />
          </FormField>
          <div>
            <p className="mb-1.5 text-label font-medium text-text-default">Combobox</p>
            <Combobox options={COMBO_OPTIONS} value={combo} onValueChange={setCombo} placeholder="Pick a workspace…" />
          </div>
          <Cluster gap="6">
            <label className="flex items-center gap-2 text-label text-text-default"><Checkbox defaultChecked /> Checkbox</label>
            <label className="flex items-center gap-2 text-label text-text-default"><Switch defaultChecked /> Switch</label>
            {/* Radix exposes a radiogroup. The per-option labels name "One" and
                "Two" but nothing names the choice itself, so a screen-reader
                user hears an unnamed group — name it explicitly. */}
            <RadioGroup aria-label="Radio group specimen" defaultValue="a" className="flex gap-4">
              <label className="flex items-center gap-2 text-label text-text-default"><RadioGroupItem value="a" /> One</label>
              <label className="flex items-center gap-2 text-label text-text-default"><RadioGroupItem value="b" /> Two</label>
            </RadioGroup>
            <ToggleGroup type="single" defaultValue="tree">
              <ToggleGroupItem value="tree">Tree</ToggleGroupItem>
              <ToggleGroupItem value="outline">Outline</ToggleGroupItem>
            </ToggleGroup>
          </Cluster>
        </Stack>
      </Section>

      <Section id="c-badge" level={3} title="Badge" note="All 10 statuses. exploring/selected share accent deliberately; folded/read-only share the neutral treatment.">
        <Cluster gap="2">{ALL_STATUSES.map((s) => <Badge key={s} status={s}>{s}</Badge>)}</Cluster>
      </Section>

      <Section id="c-alert" level={3} title="Alert banner and popup" note="Persistent in-page status (error tone is role=alert), and the imperative popup.">
        <Stack gap="2" className="max-w-xl">
          <AlertBanner tone="success" title="Success">Branch merged successfully.</AlertBanner>
          <AlertBanner tone="warning" title="Warning">This branch is 12 commits behind main.</AlertBanner>
          <AlertBanner tone="error" title="Error">Merge conflict in 2 files.</AlertBanner>
          <AlertBanner tone="info" title="Info">New activity in this branch.</AlertBanner>
        </Stack>
        <PopupDemo />
      </Section>

      <Section id="c-overlays" level={3} title="Overlays" note="dialog · alert-dialog · sheet · dropdown · popover · tooltip · hover card — shadow tokens, named z-index roles, 200ms motion.">
        <Cluster gap="3">
          <Dialog>
            <DialogTrigger asChild><Button variant="secondary">Dialog</Button></DialogTrigger>
            <DialogContent>
              <DialogTitle>Rename workspace</DialogTitle>
              <DialogDescription>Give this workspace a new name.</DialogDescription>
              <Cluster gap="2" justify="end">
                <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
                <DialogClose asChild><Button variant="primary">Save</Button></DialogClose>
              </Cluster>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive">Alert dialog</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
              <Cluster gap="2" justify="end">
                <AlertDialogCancel asChild><Button variant="secondary">Cancel</Button></AlertDialogCancel>
                <AlertDialogAction asChild><Button variant="destructive">Delete</Button></AlertDialogAction>
              </Cluster>
            </AlertDialogContent>
          </AlertDialog>
          <Sheet>
            <SheetTrigger asChild><Button variant="secondary">Sheet</Button></SheetTrigger>
            <SheetContent>
              <SheetTitle>Folded nodes</SheetTitle>
              <SheetDescription>3 nodes folded in this branch.</SheetDescription>
              <SheetClose asChild><Button variant="secondary">Close</Button></SheetClose>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="secondary">Dropdown</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem><ICONS.rename className="size-4" /> Rename</DropdownMenuItem>
              <DropdownMenuItem><ICONS.duplicate className="size-4" /> Duplicate</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive><ICONS.delete className="size-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild><Button variant="secondary"><ICONS.create className="size-4" /> Popover</Button></PopoverTrigger>
            <PopoverContent><p className="text-label text-text-default">Blank or start from an example.</p></PopoverContent>
          </Popover>
          <Tooltip>
            <TooltipTrigger asChild><Button variant="ghost">Tooltip (hover)</Button></TooltipTrigger>
            <TooltipContent>Branch this message</TooltipContent>
          </Tooltip>
          <HoverCard>
            <HoverCardTrigger asChild><Button variant="ghost">Hover card</Button></HoverCardTrigger>
            <HoverCardContent>
              <p className="font-medium text-text-default">Database selection</p>
              <p className="mt-1">Last activity 2 days ago · 4 branches.</p>
            </HoverCardContent>
          </HoverCard>
        </Cluster>
        <div>
          <p className="mb-1.5 text-label font-medium text-text-default">Context menu (right-click)</p>
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="flex h-20 w-64 items-center justify-center rounded-md border border-dashed border-border-strong text-label text-text-muted">
                Right-click me
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuLabel>Database selection</ContextMenuLabel>
              <ContextMenuItem><ICONS.rename className="size-4" /> Rename</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem destructive><ICONS.delete className="size-4" /> Delete</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </Section>

      <Section id="c-data" level={3} title="Data display" note="table · data-table (sort/filter/paginate) · progress · skeleton / spinner · separator · scroll area.">
        <Stack gap="6">
          <div className="max-w-lg">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Workspace</TableHead><TableHead>Branches</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {TABLE_ROWS.slice(0, 3).map((r) => (
                  <TableRow key={r.workspace}>
                    <TableCell>{r.workspace}</TableCell>
                    <TableCell>{r.branches}</TableCell>
                    <TableCell><Badge status={r.status}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="max-w-lg">
            <DataTable columns={TABLE_COLUMNS} data={TABLE_ROWS} filterColumn="workspace" filterPlaceholder="Filter workspaces…" pageSize={4} />
          </div>
          <Stack gap="3" className="max-w-md">
            {[30, 70, 100].map((v) => (
              <Cluster key={v} gap="3">
                <Progress value={v} aria-label={`Merge progress ${v}%`} />
                <span className="w-10 text-right font-mono text-caption text-text-muted">{v}%</span>
              </Cluster>
            ))}
          </Stack>
          <Cluster gap="8">
            <Skeleton className="h-8 w-40" />
            <Spinner />
            <Cluster gap="4" className="h-10">
              <span className="text-label text-text-secondary">Left</span>
              <Separator orientation="vertical" />
              <span className="text-label text-text-secondary">Right</span>
            </Cluster>
          </Cluster>
          <ScrollArea className="h-28 w-64 rounded-md border border-border-default bg-bg-default p-3">
            {Array.from({ length: 12 }, (_, i) => (
              <p key={i} className="py-1 text-label text-text-secondary">Folded node {i + 1}</p>
            ))}
          </ScrollArea>
        </Stack>
      </Section>

      <Section id="c-disclosure" level={3} title="Disclosure and navigation" note="tabs · accordion · breadcrumb · pagination.">
        <Stack gap="6">
          <Tabs defaultValue="tree">
            <TabsList>
              <TabsTrigger value="tree">Tree</TabsTrigger>
              <TabsTrigger value="outline">Outline</TabsTrigger>
              <TabsTrigger value="history" disabled>History</TabsTrigger>
            </TabsList>
            <TabsContent value="tree">The visual tree canvas.</TabsContent>
            <TabsContent value="outline">The folder-path outline view.</TabsContent>
          </Tabs>
          <Accordion type="single" collapsible className="max-w-md">
            <AccordionItem value="one">
              <AccordionTrigger>What is a branch?</AccordionTrigger>
              <AccordionContent>A focused child discussion split off a specific span.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="two">
              <AccordionTrigger>What happens on merge?</AccordionTrigger>
              <AccordionContent>The conclusion returns to the parent conversation.</AccordionContent>
            </AccordionItem>
          </Accordion>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="#">Workspace</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="#">Database selection</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Postgres vs MySQL</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Pagination>
            <PaginationItem aria-label="Previous page">‹</PaginationItem>
            <PaginationItem active>1</PaginationItem>
            <PaginationItem>2</PaginationItem>
            <PaginationItem>3</PaginationItem>
            <PaginationItem aria-label="Next page">›</PaginationItem>
          </Pagination>
        </Stack>
      </Section>

      <Section id="c-command" level={3} title="Command palette and resizable panels">
        <Stack gap="6">
          <div className="max-w-md overflow-hidden rounded-lg border border-border-default">
            <Command>
              <CommandInput placeholder="Search commands…" />
              <CommandList>
                <CommandEmpty>No matching command.</CommandEmpty>
                <CommandGroup heading="Workspace">
                  <CommandItem><ICONS.create className="size-4" /> New workspace<CommandShortcut>⌘N</CommandShortcut></CommandItem>
                  <CommandItem><ICONS.rename className="size-4" /> Rename workspace</CommandItem>
                </CommandGroup>
                <CommandGroup heading="Branch">
                  <CommandItem><ICONS.branch className="size-4" /> Branch from selection<CommandShortcut>⌘B</CommandShortcut></CommandItem>
                  <CommandItem><ICONS.merge className="size-4" /> Merge into parent</CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <div className="h-40 max-w-lg overflow-hidden rounded-md border border-border-default">
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize={40}>
                <div className="flex h-full items-center justify-center bg-bg-subtle text-label text-text-secondary">Tree</div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel>
                <div className="flex h-full items-center justify-center text-label text-text-secondary">Conversation</div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </Stack>
      </Section>
    </Stack>
  )
}

export function SystemShowcaseGallery() {
  return (
    <AppTooltipProvider>
      <AlertPopupProvider>
        <main id="main" className="min-h-screen bg-bg-default py-8">
          <Container>
            <Stack gap="6">
              <Stack as="header" gap="2">
                <h1 className="text-title font-medium text-text-default">A-T3d — System showcase</h1>
                <p className="max-w-prose text-label text-text-muted">
                  The A-T3 foundation rendered from the shipped files: type roles (ADR-0001), the spacing
                  grid (ADR-0002), layout primitives, the normalized `ui/` set, and the sizing convention
                  in action (ADR-0003). Resolved values are read from the live stylesheet. Dev-only.
                </p>
                <Cluster gap="4">
                  <span className="text-caption text-text-muted">Review the same system in situ:</span>
                  <Link to={PATHS.root}>public landing</Link>
                  <Link to={PATHS.login}>sign-in</Link>
                  <Link to="/definitely-not-a-route">not-found</Link>
                </Cluster>
              </Stack>

              <Section id="type" title="Type scale — as a ladder, and in prose" note="Six semantic roles over Tailwind's default primitive scale. Each role aliases both size and line height.">
                <TypeScale />
              </Section>

              <Section id="spacing" title="Spacing scale — 19 steps, no token layer" note="Figma's locked space/* values all land on Tailwind's 4px grid, so the grid is the standard (ADR-0002).">
                <SpacingScale />
              </Section>

              <Section id="layout" title="Layout primitives — Stack, Cluster, Container" note="The three A06 shipped (A-T3c's deferred deliverable). Their gap/gutter props accept a 12-step subset of the 19 (0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 24) — the steps a layout gap plausibly takes; finer steps stay available as plain utilities.">
                <LayoutPrimitives />
              </Section>

              <Section id="conventions" title="Sizing convention in action" note="What ADR-0003 actually claims, shown rather than asserted.">
                <ConventionExamples />
              </Section>

              <Section id="components" title="Normalized components" note="A05a's ui/ set on the A-T3 tokens. Any regression from normalization should be visible here.">
                <Components />
              </Section>

              <Section id="gaps" title="Known gaps — flagged, not smoothed over">
                <ul className="m-0 list-disc pl-5 text-label text-text-secondary">
                  <li>
                    A-T3c's absorbed criterion "visual before/after comparison of a representative sample" has no
                    "before" to render: the pre-normalization components no longer exist in the tree. The comparison
                    is by commit diff and by eye against the A05a gallery's screenshots, not on this page.
                  </li>
                  <li>
                    Contrast is not verified here (A13 owns it). Known open: white text on the teal primary Button
                    (3.95:1). The gallery shows it as shipped.
                  </li>
                  <li>
                    The shipped Combobox trigger has no accessible name: a `role="combobox"` element
                    cannot take its name from content, so the placeholder text is its value, not its
                    label, and the component exposes no `aria-label`/`id` route (axe `button-name`,
                    critical). Surfaced by this page's scan; routed to A13 rather than patched here.
                  </li>
                  <li>
                    The shipped Pagination gives consumers no built-in previous/next control; the
                    specimen names its glyph buttons itself with `aria-label`. A named pair belongs
                    in the component (A13).
                  </li>
                  <li>
                    A11a still carries three pinned component widths from the sizing audit; they are not on this
                    page because the components that own them are the tree canvas, not the ui/ set.
                  </li>
                </ul>
              </Section>
            </Stack>
          </Container>
        </main>
      </AlertPopupProvider>
    </AppTooltipProvider>
  )
}
