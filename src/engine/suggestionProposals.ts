import type { Hemisphere, Task } from '../types'
import { buildTaskQueue } from './scheduler'
import { suggestActivities } from './suggestions'

const MIN_CHUNK = 15 // smallest proposal we'll offer (minutes), mirrors the scheduler

/** A single, approvable suggestion for a free window. Pure data — no React/store. */
export interface Proposal {
  kind: 'task' | 'activity'
  title: string
  refId?: string // task id, when kind === 'task'
  suggestion?: string // the activity idea text, when kind === 'activity'
  durationMinutes: number // clamped to fit the gap (and the task's per-day cap)
}

export interface ProposalContext {
  tasks: Task[]
  interestKeys: string[]
  date: Date
  hemisphere: Hemisphere
}

/**
 * Rank approvable proposals for a free window of `gapMinutes`.
 *
 * Task proposals come first by urgency (deadline → priority → age, via
 * `buildTaskQueue`), each clamped to the gap and to its remaining work /
 * `maxPerDayMinutes`. Activity proposals (season + interest aware) are
 * interleaved after the top task so the user always sees a productive option
 * and a restful one near the top. Returns [] when nothing fits.
 */
export function suggestForGap(gapMinutes: number, ctx: ProposalContext): Proposal[] {
  if (gapMinutes < MIN_CHUNK) return []

  const taskProposals: Proposal[] = []
  for (const t of buildTaskQueue(ctx.tasks)) {
    const cap = Math.min(t.remainingMinutes, t.maxPerDayMinutes ?? Infinity, gapMinutes)
    if (cap < MIN_CHUNK) continue
    taskProposals.push({
      kind: 'task',
      title: t.title,
      refId: t.id,
      durationMinutes: cap,
    })
  }

  const activityProposals: Proposal[] = suggestActivities(
    ctx.interestKeys,
    ctx.date,
    ctx.hemisphere,
    8,
  ).map((text) => ({
    kind: 'activity',
    title: text,
    suggestion: text,
    durationMinutes: gapMinutes,
  }))

  // Interleave: top task, top activity, then the rest of the tasks, then the
  // remaining activities. Keeps a productive + a restful option near the top.
  const out: Proposal[] = []
  if (taskProposals.length) out.push(taskProposals[0])
  if (activityProposals.length) out.push(activityProposals[0])
  out.push(...taskProposals.slice(1), ...activityProposals.slice(1))
  return out
}
