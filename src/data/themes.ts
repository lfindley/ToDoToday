// Accent colour schemes. Each theme just flips a set of CSS variables that the
// Tailwind `brand` palette is wired to (see index.css + tailwind.config.js), so
// every existing `bg-brand-*` / `text-brand-*` class re-themes automatically.

import type { ThemeName } from '../types'

export interface ThemeOption {
  name: ThemeName
  label: string
  /** The `brand-600` hex, used for the swatch dot in the picker. */
  swatch: string
}

export const THEMES: ThemeOption[] = [
  { name: 'blue', label: 'Ocean', swatch: '#2563eb' },
  { name: 'violet', label: 'Grape', swatch: '#7c3aed' },
  { name: 'emerald', label: 'Forest', swatch: '#059669' },
  { name: 'teal', label: 'Lagoon', swatch: '#0d9488' },
  { name: 'rose', label: 'Rose', swatch: '#e11d48' },
  { name: 'amber', label: 'Sunset', swatch: '#d97706' },
]

export const DEFAULT_THEME: ThemeName = 'blue'
