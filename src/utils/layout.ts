// Vertical layout for the time-grid views (Today timeline + Week grid).
//
// Blocks are positioned absolutely by their start time. A readable minimum
// height is desirable, but applying it blindly makes a short block taller than
// its time slot, so it overlaps the following block. `blockHeights` caps each
// block's height so it never extends past the next block's start — contiguous
// short blocks shrink to fit instead of overlapping, while a block with free
// space below it can still grow to the minimum height.

import { parseTime } from './time'

export interface LaidOutBlock {
  id: string
  start: string // "HH:mm"
  end: string // "HH:mm"
}

export interface BlockHeightOpts {
  /** Minutes-from-midnight of the bottom of the grid (so the last block can't overrun). */
  dayEnd: number
  /** Pixels per minute. */
  px: number
  /** Desired minimum block height in px, applied only where there's room. */
  min: number
}

/** Map of block id → rendered height in px, guaranteed not to overlap the next block. */
export function blockHeights(
  blocks: LaidOutBlock[],
  { dayEnd, px, min }: BlockHeightOpts,
): Record<string, number> {
  const sorted = [...blocks].sort((a, b) => parseTime(a.start) - parseTime(b.start))
  const out: Record<string, number> = {}
  sorted.forEach((b, i) => {
    const start = parseTime(b.start)
    const end = parseTime(b.end)
    const nextStart = i + 1 < sorted.length ? parseTime(sorted[i + 1].start) : dayEnd
    // Room available before the next block begins (never negative).
    const slot = Math.max(0, Math.min(nextStart, dayEnd) - start) * px
    const desired = Math.max(min, (end - start) * px)
    out[b.id] = Math.max(2, Math.min(desired, slot))
  })
  return out
}
