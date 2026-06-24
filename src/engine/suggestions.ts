import type { Hemisphere } from '../types'
import { seasonForDate } from './season'
import { SUGGESTIONS, type SuggestionItem } from '../data/suggestions'

/** All dataset items that match the user's interests for this date's season/month. */
export function candidateSuggestions(
  interestKeys: string[],
  date: Date,
  hemisphere: Hemisphere = 'north',
): SuggestionItem[] {
  const season = seasonForDate(date, hemisphere)
  const month = date.getMonth() + 1
  const keys = new Set(interestKeys)
  return SUGGESTIONS.filter(
    (s) =>
      s.interests.some((k) => keys.has(k)) &&
      s.seasons.includes(season) &&
      (!s.months || s.months.includes(month)),
  )
}

// Deterministic shuffle: stable for a given day, but different day-to-day.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** A handful of fresh, season-appropriate activity ideas for the given interests. */
export function suggestActivities(
  interestKeys: string[],
  date: Date,
  hemisphere: Hemisphere = 'north',
  count = 5,
): string[] {
  const candidates = candidateSuggestions(interestKeys, date, hemisphere)
  if (candidates.length === 0) return []
  const seed = date.getFullYear() * 372 + (date.getMonth() + 1) * 31 + date.getDate()
  return seededShuffle(candidates, seed)
    .slice(0, count)
    .map((s) => s.text)
}
