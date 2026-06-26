import { describe, it, expect } from 'vitest'
import { blockHeights } from '../utils/layout'

const dayEnd = 24 * 60

describe('blockHeights', () => {
  it('caps a short block so it does not overlap the next block', () => {
    // 08:00–08:45, 08:45–09:00 (15 min), 09:00–10:00 — all contiguous.
    const blocks = [
      { id: 'a', start: '08:00', end: '08:45' },
      { id: 'b', start: '08:45', end: '09:00' },
      { id: 'c', start: '09:00', end: '10:00' },
    ]
    const h = blockHeights(blocks, { dayEnd, px: 1.1, min: 22 })
    // The 15-min block is only 16.5px of slot; even though min is 22, it must
    // not exceed its slot, or it would overlap the 09:00 block.
    expect(h['b']).toBeCloseTo(15 * 1.1, 5)
  })

  it('does not let any block extend past the next block start', () => {
    const blocks = [
      { id: 'a', start: '08:00', end: '08:45' },
      { id: 'b', start: '08:45', end: '09:00' },
      { id: 'c', start: '09:00', end: '10:00' },
    ]
    const h = blockHeights(blocks, { dayEnd, px: 1.1, min: 22 })
    const top = (s: string) => (Number(s.slice(0, 2)) * 60 + Number(s.slice(3))) * 1.1
    for (const b of blocks.slice(0, -1)) {
      const next = blocks[blocks.indexOf(b) + 1]
      expect(top(b.start) + h[b.id]).toBeLessThanOrEqual(top(next.start) + 0.001)
    }
  })

  it('grows a short block to the minimum when there is free space below', () => {
    // A lone 15-min block with the rest of the day free.
    const h = blockHeights([{ id: 'a', start: '08:00', end: '08:15' }], {
      dayEnd,
      px: 1.1,
      min: 22,
    })
    expect(h['a']).toBe(22)
  })

  it('renders order-independently (sorts by start)', () => {
    const blocks = [
      { id: 'c', start: '09:00', end: '10:00' },
      { id: 'a', start: '08:00', end: '08:45' },
      { id: 'b', start: '08:45', end: '09:00' },
    ]
    const h = blockHeights(blocks, { dayEnd, px: 1.1, min: 22 })
    expect(h['b']).toBeCloseTo(15 * 1.1, 5)
  })
})
