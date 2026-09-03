import {
  Compass,
  PlusCircle,
  GitBranch,
  ArrowLeftCircle,
  GitPullRequestArrow,
  CheckCircle2,
  XCircle,
  RotateCw,
  RefreshCw,
  PencilLine,
  Copy,
  CopyPlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelTopClose,
  PanelTopOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Expand,
  Shrink,
  Maximize2,
  Minimize2,
  AlertTriangle,
  User,
  MoreHorizontal,
  MoreVertical,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

/**
 * A05b's semantic icon-to-action mapping. One entry per product action
 * category, decided via the candidate-comparison process recorded in
 * docs/mvp-1.5/A05b-icon-system-and-selection.md. Import from here rather
 * than lucide-react directly, so every surface stays consistent and future
 * changes happen in one place.
 */
export const ICONS = {
  navigate: Compass,
  create: PlusCircle,
  branch: GitBranch,
  return: ArrowLeftCircle,
  merge: GitPullRequestArrow,
  approve: CheckCircle2,
  reject: XCircle,
  retry: RotateCw,
  refresh: RefreshCw,
  rename: PencilLine,
  copy: Copy,
  duplicate: CopyPlus,
  warning: AlertTriangle,
  account: User,
  delete: Trash2,
} satisfies Record<string, LucideIcon>;

/**
 * Sidebar/panel collapse-expand, one pair per orientation. All four kept
 * live per owner review — pick whichever orientation the surface needs.
 */
export const PANEL_TOGGLE_ICONS = {
  left: { close: PanelLeftClose, open: PanelLeftOpen },
  right: { close: PanelRightClose, open: PanelRightOpen },
  top: { close: PanelTopClose, open: PanelTopOpen },
  bottom: { close: PanelBottomClose, open: PanelBottomOpen },
} satisfies Record<string, { close: LucideIcon; open: LucideIcon }>;

/**
 * Fullscreen/expand toggle. Expand/Shrink is the default pair; Maximize2/
 * Minimize2 is kept as a valid alternate for contexts where it reads better
 * (both pairs were explicitly approved, not narrowed to one).
 */
export const FULLSCREEN_TOGGLE_ICONS = {
  default: { expand: Expand, shrink: Shrink },
  alternate: { expand: Maximize2, shrink: Minimize2 },
} satisfies Record<string, { expand: LucideIcon; shrink: LucideIcon }>;

/**
 * Overflow menu trigger. Both orientations kept live per owner review —
 * horizontal is the more common default, vertical for specific
 * vertical-menu contexts.
 */
export const OVERFLOW_ICONS = {
  horizontal: MoreHorizontal,
  vertical: MoreVertical,
} satisfies Record<string, LucideIcon>;

/**
 * Icons deliberately NOT covered by this mapping — kept as-is, not
 * migrated to Lucide. LoginPage.tsx's Google "G" logo stays as MUI's
 * GoogleIcon: Google's brand guidelines require their official logo mark
 * on "Sign in with Google" buttons, so no Lucide substitute is brand-compliant.
 */
export const ICON_EXCEPTIONS = {
  googleSignIn: 'Stays as @mui/icons-material GoogleIcon — brand requirement, not a Lucide candidate.',
} as const;
