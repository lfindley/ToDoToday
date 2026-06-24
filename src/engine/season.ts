import type { Hemisphere, Season } from '../types'

/** Meteorological seasons. Northern hemisphere by default. */
export function seasonForDate(date: Date, hemisphere: Hemisphere = 'north'): Season {
  const month = date.getMonth() // 0–11
  const north: Season =
    month === 11 || month <= 1
      ? 'winter'
      : month <= 4
        ? 'spring'
        : month <= 7
          ? 'summer'
          : 'autumn'
  if (hemisphere === 'north') return north
  // Southern hemisphere is offset by two seasons.
  const flip: Record<Season, Season> = {
    winter: 'summer',
    spring: 'autumn',
    summer: 'winter',
    autumn: 'spring',
  }
  return flip[north]
}

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
}

export const SEASON_EMOJI: Record<Season, string> = {
  spring: '🌱',
  summer: '☀️',
  autumn: '🍂',
  winter: '❄️',
}
