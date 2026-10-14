import { supabase } from '@/lib/supabase'

// Matthew's companies, from the folder list. One constant, both surfaces.
// Folder names were truncated in the screenshot; these are the names to store.
export const TASK_ENTITIES = [
  'AVALANCHE',
  'BLACKBEARD DEVELOPMENT',
  'G STREET PARTNERS',
  'LANDSLIDE PROPERTIES',
  'MAELSTROM VENTURES',
  'MONSOON PROPERTIES',
  'ROOSTER DEVELOPMENT',
  'SIR GALAHAD, LLC',
  'SUPERNOVA HOLDINGS',
  'WILDFIRE VENTURES',
  'X-CHECKER INVESTMENTS',
] as const

export type TaskEntityName = (typeof TASK_ENTITIES)[number]

export type TaskTag = 'life' | 'sr' | 'entity'

/** How long a new Battle Plan row holds its purple line. */
export const TASK_ARRIVE_MS = 700

export interface ArrivingRow {
  id: string
  clientKey?: string
  flashUntil?: number
}

/** Pending row stays through the flash, then the saved row takes its place. */
export function arrivingRows<T extends ArrivingRow>(saved: T[], pending: T[], now = Date.now()): T[] {
  const holding = pending.filter(p => !saved.some(t => t.id === p.id) || (p.flashUntil ?? 0) > now)
  const holdIds = new Set(holding.map(p => p.id))
  return [...holding, ...saved.filter(t => !holdIds.has(t.id))]
}

export function arrivedIds<T extends ArrivingRow>(saved: T[], pending: T[], now = Date.now()): string[] {
  return pending
    .filter(p => saved.some(t => t.id === p.id) && (p.flashUntil ?? 0) <= now)
    .map(p => p.id)
}

export const TASK_TAG_OPTIONS: { key: TaskTag; label: string }[] = [
  { key: 'life', label: 'Life' },
  { key: 'sr', label: 'SR' },
  { key: 'entity', label: 'Entity' },
]

export interface TaskTagSource {
  is_life?: boolean | null
  is_entity?: boolean | null
  is_sr?: boolean | null
  entity_name?: string | null
  entities?: { name?: string | null } | null
}

/** Life, then SR, then Entity. A task with none of the flags is untagged. */
export function taskTagOf(task: TaskTagSource): TaskTag | null {
  if (task.is_life) return 'life'
  if (task.is_sr) return 'sr'
  if (task.is_entity) return 'entity'
  return null
}

/** Sentence label for the detail sheet. Entity prefers the chosen company. */
export function taskTagLabel(task: TaskTagSource): string | null {
  const tag = taskTagOf(task)
  if (tag === 'life') return 'Life'
  if (tag === 'sr') return 'SR'
  if (tag === 'entity') return task.entity_name || task.entities?.name || 'Entity'
  return null
}

/** Mono badge for a Battle Plan row. */
export function taskTagBadge(task: TaskTagSource): string | null {
  const tag = taskTagOf(task)
  if (tag === 'life') return 'LIFE'
  if (tag === 'sr') return 'SR'
  if (tag === 'entity') return (task.entity_name || task.entities?.name || 'ENTITY').toUpperCase()
  return null
}

/** Columns written for a tag. is_sr and entity_name are additive and may be absent. */
export function taskTagWrite(tag: TaskTag | null, entityName: string | null): Record<string, unknown> {
  return {
    is_life: tag === 'life',
    is_entity: tag === 'entity',
    is_sr: tag === 'sr',
    entity_name: tag === 'entity' ? entityName : null,
  }
}

const OPTIONAL_TAG_COLUMNS = ['is_sr', 'entity_name'] as const

export function missingColumn(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return msg.includes('42703')
    || msg.includes('pgrst204')
    || (msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find')))
}

function columnNamedIn(error: { message?: string }): string | null {
  const msg = error.message ?? ''
  const quoted = msg.match(/'([^']+)'/)
  if (quoted && (OPTIONAL_TAG_COLUMNS as readonly string[]).includes(quoted[1])) return quoted[1]
  for (const col of OPTIONAL_TAG_COLUMNS) {
    if (msg.includes(col)) return col
  }
  return null
}

export const TAG_COLUMN_NOTICE = 'Saved. SR and the entity name need the new database columns before they stick. Life and Entity are stored.'

function degraded(tag: TaskTag | null, entityName: string | null, payload: Record<string, unknown>): boolean {
  if (tag === 'sr' && !('is_sr' in payload)) return true
  if (tag === 'entity' && entityName && !('entity_name' in payload)) return true
  return false
}

type DbError = { message?: string; code?: string }

async function writeWithFallback(
  run: (payload: Record<string, unknown>) => Promise<{ data: { id: string } | null; error: DbError | null }>,
  row: Record<string, unknown>,
  tag: TaskTag | null,
  entityName: string | null,
): Promise<{ id: string | null; error: DbError | null; degraded: boolean }> {
  let payload = { ...row }
  for (let attempt = 0; attempt < OPTIONAL_TAG_COLUMNS.length + 2; attempt++) {
    const { data, error } = await run(payload)
    if (!error) {
      return { id: data?.id ?? null, error: null, degraded: degraded(tag, entityName, payload) }
    }
    if (!missingColumn(error)) return { id: null, error, degraded: false }
    const named = columnNamedIn(error)
    if (named && named in payload) {
      const next = { ...payload }
      delete next[named]
      payload = next
      continue
    }
    let stripped = false
    const next = { ...payload }
    for (const col of OPTIONAL_TAG_COLUMNS) {
      if (col in next) {
        delete next[col]
        stripped = true
      }
    }
    if (!stripped) return { id: null, error, degraded: false }
    payload = next
  }
  return { id: null, error: { message: 'Save failed' }, degraded: false }
}

export async function insertTaskRow(
  row: Record<string, unknown>,
  tag: TaskTag | null,
  entityName: string | null,
): Promise<{ id: string | null; error: DbError | null; degraded: boolean }> {
  return writeWithFallback(async (payload) => {
    const { data, error } = await supabase.from('tasks').insert(payload).select('id').single()
    return { data: data as { id: string } | null, error }
  }, row, tag, entityName)
}

export async function persistTaskTag(
  taskId: string,
  tag: TaskTag | null,
  entityName: string | null,
): Promise<{ ok: boolean; degraded: boolean; message?: string }> {
  const result = await writeWithFallback(async (payload) => {
    const { error } = await supabase.from('tasks').update(payload).eq('id', taskId)
    return { data: { id: taskId }, error }
  }, taskTagWrite(tag, entityName), tag, entityName)
  if (result.error) return { ok: false, degraded: false, message: result.error.message || 'Save failed' }
  if (result.degraded) return { ok: true, degraded: true, message: TAG_COLUMN_NOTICE }
  return { ok: true, degraded: false }
}

/**
 * Run a tasks select with is_sr and entity_name, then again without them
 * if PostgREST reports those columns are not in the schema yet.
 */
export async function selectTasks<T>(
  build: (tagColumns: string) => PromiseLike<{ data: any; error: DbError | null }>,
): Promise<{ data: T[] | null; error: DbError | null }> {
  const rich = await build('is_life, is_entity, is_sr, entity_name')
  if (!rich.error) return { data: (rich.data ?? null) as T[] | null, error: null }
  if (!missingColumn(rich.error)) return { data: null, error: rich.error }
  const basic = await build('is_life, is_entity')
  return { data: (basic.data ?? null) as T[] | null, error: basic.error }
}
