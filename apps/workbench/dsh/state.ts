/**
 * Workbench data model: the local, user-owned project roster and the derived
 * control-room readings. Everything here is browser-local — the roster lives in
 * `localStorage` under {@link STORAGE_KEY}, so the workbench survives reloads
 * with no Host service and no session log involvement.
 */

/** Project lifecycle state shown on a card and used for filtering. */
export type WorkbenchProjectStatus = 'active' | 'paused' | 'shipped' | 'archived'

/** One user-defined project card. */
export interface WorkbenchProject {
  /** Stable local id (also the React key and the reorder handle). */
  id: string
  /** Display name. */
  name: string
  /** Absolute or workspace-relative directory; shown verbatim, never resolved. */
  path: string
  /** One-line description of what the project is. */
  note: string
  /** Lifecycle state. */
  status: WorkbenchProjectStatus
  /** Accent color token key, resolved by the stylesheet to a gradient. */
  accent: WorkbenchAccent
  /** Completed units of work, for the card's progress bar. */
  done: number
  /** Total units of work; 0 renders an indeterminate card. */
  total: number
  /** Free-text next step, shown at the card foot. */
  next: string
  /** Creation time (epoch ms); the roster sorts newest first by default. */
  createdAt: number
}

/** Accent palette keys the stylesheet maps to gradients. */
export type WorkbenchAccent = 'azure' | 'violet' | 'amber' | 'emerald' | 'rose' | 'slate'

/** Persisted workbench state. */
export interface WorkbenchState {
  /** Persisted schema version; an unknown version resets to the seed roster. */
  version: number
  /** The user's project cards. */
  projects: WorkbenchProject[]
}

/** Current persisted schema version. */
export const WORKBENCH_STATE_VERSION = 1

/** `localStorage` key holding the persisted workbench state. */
export const STORAGE_KEY = 'dsh.workbench.v1'

/** Accent keys in palette order (the picker's render order). */
export const ACCENTS: readonly WorkbenchAccent[] = ['azure', 'violet', 'amber', 'emerald', 'rose', 'slate']

/** Status values in lifecycle order (the picker's render order). */
export const STATUSES: readonly WorkbenchProjectStatus[] = ['active', 'paused', 'shipped', 'archived']

/** A metric reading shown in the control room's live strip. */
export interface ControlRoomReading {
  /** Stable key used for the render key and the accent class. */
  id: string
  /** Reading label. */
  label: string
  /** Reading value, already formatted for display. */
  value: string
  /** Optional supporting line under the value. */
  hint?: string
}

/** Normalize a persisted project, dropping anything the card cannot render. */
function normalizeProject(value: unknown): WorkbenchProject | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Partial<WorkbenchProject>
  if (typeof candidate.id !== 'string' || candidate.id === '') return undefined
  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') return undefined
  const status = STATUSES.includes(candidate.status as WorkbenchProjectStatus)
    ? candidate.status as WorkbenchProjectStatus
    : 'active'
  const accent = ACCENTS.includes(candidate.accent as WorkbenchAccent)
    ? candidate.accent as WorkbenchAccent
    : 'azure'
  const done = typeof candidate.done === 'number' && Number.isFinite(candidate.done)
    ? Math.max(0, Math.trunc(candidate.done))
    : 0
  const total = typeof candidate.total === 'number' && Number.isFinite(candidate.total)
    ? Math.max(0, Math.trunc(candidate.total))
    : 0
  return {
    id: candidate.id,
    name: candidate.name,
    path: typeof candidate.path === 'string' ? candidate.path : '',
    note: typeof candidate.note === 'string' ? candidate.note : '',
    status,
    accent,
    done,
    total,
    next: typeof candidate.next === 'string' ? candidate.next : '',
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
  }
}

/** Normalize a parsed state document, or undefined when it is not this schema. */
export function normalizeState(value: unknown): WorkbenchState | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Partial<WorkbenchState>
  if (candidate.version !== WORKBENCH_STATE_VERSION) return undefined
  if (!Array.isArray(candidate.projects)) return undefined
  return {
    version: WORKBENCH_STATE_VERSION,
    projects: candidate.projects.map(normalizeProject).filter((p): p is WorkbenchProject => p !== undefined),
  }
}

/** Read the persisted state, falling back to an empty roster. */
export function loadState(): WorkbenchState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return { version: WORKBENCH_STATE_VERSION, projects: [] }
    return normalizeState(JSON.parse(raw)) ?? { version: WORKBENCH_STATE_VERSION, projects: [] }
  } catch {
    // Storage may be unavailable (private mode, disabled cookies) or hold a
    // foreign value; either way the workbench opens on an empty roster.
    return { version: WORKBENCH_STATE_VERSION, projects: [] }
  }
}

/** Persist the roster; a storage failure leaves the in-memory state authoritative. */
export function saveState(state: WorkbenchState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota or disabled storage: the session keeps working, unsaved.
  }
}

/** A blank project card for the "add" flow. */
export function createProject(overrides: Partial<WorkbenchProject> = {}): WorkbenchProject {
  const suffix = Math.random().toString(36).slice(2, 8)
  return {
    id: `p-${Date.now().toString(36)}-${suffix}`,
    name: '',
    path: '',
    note: '',
    status: 'active',
    accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)] ?? 'azure',
    done: 0,
    total: 0,
    next: '',
    createdAt: Date.now(),
    ...overrides,
  }
}

/** Completion ratio in the closed range [0, 1]; 0 when no total is set. */
export function progressOf(project: WorkbenchProject): number {
  if (project.total <= 0) return 0
  return Math.min(1, Math.max(0, project.done / project.total))
}

/** Project counts by status plus the aggregate completion ratio. */
export function summarize(projects: readonly WorkbenchProject[]): {
  counts: Record<WorkbenchProjectStatus, number>
  done: number
  total: number
  ratio: number
} {
  const counts: Record<WorkbenchProjectStatus, number> = { active: 0, paused: 0, shipped: 0, archived: 0 }
  let done = 0
  let total = 0
  for (const project of projects) {
    counts[project.status] += 1
    done += project.done
    total += project.total
  }
  return { counts, done, total, ratio: total <= 0 ? 0 : Math.min(1, done / total) }
}

/** Format the wall clock reading as `HH:MM:SS`. */
export function clockText(now: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

/** Format a local date as `MM-DD`. */
export function dateText(now: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
