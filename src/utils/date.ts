import { format } from 'date-fns'

export function isoDate(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function prettyDate(iso: string): string {
  return format(isoToDate(iso), 'EEEE d MMMM yyyy')
}

export function shortDate(iso: string): string {
  return format(isoToDate(iso), 'EEE d MMM')
}

export function addDaysISO(iso: string, days: number): string {
  const d = isoToDate(iso)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}
