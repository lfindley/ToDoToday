import { describe, it, expect } from 'vitest'
import { seasonForDate } from '../engine/season'
import { candidateSuggestions, suggestActivities } from '../engine/suggestions'

describe('season', () => {
  it('maps months to northern-hemisphere seasons', () => {
    expect(seasonForDate(new Date(2026, 0, 15), 'north')).toBe('winter') // Jan
    expect(seasonForDate(new Date(2026, 3, 15), 'north')).toBe('spring') // Apr
    expect(seasonForDate(new Date(2026, 6, 15), 'north')).toBe('summer') // Jul
    expect(seasonForDate(new Date(2026, 9, 15), 'north')).toBe('autumn') // Oct
  })

  it('inverts seasons for the southern hemisphere', () => {
    expect(seasonForDate(new Date(2026, 6, 15), 'south')).toBe('winter') // Jul
    expect(seasonForDate(new Date(2026, 0, 15), 'south')).toBe('summer') // Jan
  })
})

describe('suggestions', () => {
  it('only returns activities matching the chosen interests', () => {
    const summer = new Date(2026, 6, 15)
    const ideas = candidateSuggestions(['reading'], summer, 'north')
    expect(ideas.length).toBeGreaterThan(0)
    for (const s of ideas) expect(s.interests).toContain('reading')
  })

  it('filters by season', () => {
    const winter = new Date(2026, 0, 15)
    const ideas = candidateSuggestions(['reading'], winter, 'north')
    for (const s of ideas) expect(s.seasons).toContain('winter')
  })

  it('returns nothing when no interests are selected', () => {
    expect(suggestActivities([], new Date(2026, 6, 15), 'north')).toEqual([])
  })

  it('returns at most the requested count and is stable for a given day', () => {
    const day = new Date(2026, 6, 15)
    const a = suggestActivities(['reading', 'fitness', 'cooking', 'film'], day, 'north', 3)
    const b = suggestActivities(['reading', 'fitness', 'cooking', 'film'], day, 'north', 3)
    expect(a.length).toBeLessThanOrEqual(3)
    expect(a).toEqual(b)
  })
})
