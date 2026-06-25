import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ScheduledBlock } from '../types'

/** Color palette per block type, shared by the Today timeline and Week grid. */
export const BLOCK_STYLES: Record<ScheduledBlock['type'], { bg: string; bar: string }> = {
  meal: { bg: 'bg-amber-50 border-amber-200', bar: 'bg-amber-400' },
  recurring: { bg: 'bg-violet-50 border-violet-200', bar: 'bg-violet-400' },
  task: { bg: 'bg-sky-50 border-sky-200', bar: 'bg-sky-500' },
  free: { bg: 'bg-emerald-50 border-emerald-200', bar: 'bg-emerald-400' },
  buffer: { bg: 'bg-slate-50 border-slate-200', bar: 'bg-slate-300' },
  sleep: { bg: 'bg-indigo-50 border-indigo-200', bar: 'bg-indigo-400' },
  event: { bg: 'bg-rose-50 border-rose-200', bar: 'bg-rose-500' },
}

export const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm disabled:bg-slate-100'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>{children}</div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline'
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles: Record<string, string> = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white',
    ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    outline: 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700',
    danger: 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200',
  }
  return (
    <button
      {...props}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-400 mt-1">{hint}</span>}
    </label>
  )
}

const PRIORITY_COLORS = [
  'bg-slate-100 text-slate-500', // 1-2
  'bg-sky-100 text-sky-700', // 3-4
  'bg-amber-100 text-amber-700', // 5-6
  'bg-orange-100 text-orange-700', // 7-8
  'bg-red-100 text-red-700', // 9-10
]

export function priorityColor(p: number): string {
  return PRIORITY_COLORS[Math.min(4, Math.floor((Math.max(1, p) - 1) / 2))]
}

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className={`inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded-md text-xs font-semibold ${priorityColor(priority)}`}>
      P{priority}
    </span>
  )
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-2">{icon}</div>
      <div className="font-medium text-slate-700">{title}</div>
      {children && <div className="text-sm text-slate-500 mt-1">{children}</div>}
    </div>
  )
}

export function CapacityBar({
  segments,
  total,
  height = 'h-3',
}: {
  segments: { min: number; color: string; label: string }[]
  total: number
  height?: string
}) {
  return (
    <div className={`${height} rounded-full overflow-hidden bg-slate-100 flex`}>
      {segments.map((s, i) =>
        s.min > 0 && total > 0 ? (
          <div key={i} className={s.color} style={{ width: `${(s.min / total) * 100}%` }} title={s.label} />
        ) : null,
      )}
    </div>
  )
}

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  )
}
