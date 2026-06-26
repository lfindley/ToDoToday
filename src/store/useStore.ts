import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { differenceInCalendarDays } from 'date-fns'
import type {
  Alert,
  Budgets,
  CalendarEvent,
  DayPlan,
  DayTemplate,
  Interest,
  Meal,
  RecurringTask,
  ScheduledBlock,
  Settings,
  Task,
  TimeWindow,
} from '../types'
import { uid } from '../utils/id'
import { isoDate, isoToDate } from '../utils/date'
import { parseTime, formatTime } from '../utils/time'
import { planHorizon } from '../engine/scheduler'
import { suggestForGap } from '../engine/suggestionProposals'
import { computeAlerts } from '../engine/alerts'
import { INTEREST_LABEL } from '../data/interests'

const DEFAULT_TEMPLATE: DayTemplate = {
  sleep: { bedtime: '23:00', wakeTime: '07:00' },
  meals: [
    { id: uid('meal'), name: 'Breakfast', time: '08:00', durationMinutes: 30 },
    { id: uid('meal'), name: 'Lunch', time: '13:00', durationMinutes: 45 },
    { id: uid('meal'), name: 'Dinner', time: '19:00', durationMinutes: 60 },
  ],
}

const DEFAULT_BUDGETS: Budgets = { productiveMinutesPerDay: 360, freeMinutesPerDay: 120 }
const DEFAULT_SETTINGS: Settings = {
  hemisphere: 'north',
  bufferMinutes: 0,
  browserNotifications: false,
  timeFormat: '24h',
  theme: 'blue',
  colorMode: 'system',
}

export interface NewTaskInput {
  title: string
  notes?: string
  priority: number
  estimatedMinutes: number
  maxPerDayMinutes?: number
  deadline?: string
  window?: TimeWindow
}

/** The slice of state that is persisted and synced (see `partialize` below). */
export type PersistedState = Pick<
  StoreState,
  | 'tasks'
  | 'recurring'
  | 'events'
  | 'interests'
  | 'template'
  | 'budgets'
  | 'settings'
  | 'dayPlans'
  | 'alerts'
>

interface StoreState {
  tasks: Task[]
  recurring: RecurringTask[]
  events: CalendarEvent[]
  interests: Interest[]
  template: DayTemplate
  budgets: Budgets
  settings: Settings
  dayPlans: Record<string, DayPlan>
  alerts: Alert[]
  /**
   * Has the user been through the first-run startup screen? Persisted locally
   * but deliberately NOT part of the synced `PersistedState` — it's a per-device
   * UI flag, not planner content.
   */
  onboarded: boolean

  // Tasks
  addTask: (t: NewTaskInput) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleTaskComplete: (id: string) => void

  // Recurring
  addRecurring: (r: Omit<RecurringTask, 'id'>) => void
  updateRecurring: (id: string, patch: Partial<RecurringTask>) => void
  deleteRecurring: (id: string) => void

  // Events (one-off appointments)
  addEvent: (e: Omit<CalendarEvent, 'id'>) => void
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void

  // Calendar import (.ics) — implemented by the calendar-import feature.
  importEvents: (events: CalendarEvent[]) => void
  clearImportedEvents: () => void

  // Interactive suggestions — implemented by the suggestions feature.
  proposeForWindow: (dateISO: string, startMin: number, endMin: number) => void
  acceptProposal: (dateISO: string, blockId: string) => void
  dismissProposal: (dateISO: string, blockId: string) => void

  // Interests
  toggleInterest: (categoryKey: string) => void
  addCustomInterest: (label: string) => void
  removeInterest: (id: string) => void

  // Template / budgets / settings
  setSleep: (bedtime: string, wakeTime: string) => void
  addMeal: () => void
  updateMeal: (id: string, patch: Partial<Meal>) => void
  removeMeal: (id: string) => void
  setBudgets: (b: Partial<Budgets>) => void
  setSettings: (s: Partial<Settings>) => void

  // Plan
  replan: (fromISO?: string, freshStart?: boolean) => void
  toggleBlockDone: (dateISO: string, blockId: string) => void
  moveBlock: (dateISO: string, blockId: string, newStartMinutes: number) => void
  setBlockLocked: (dateISO: string, blockId: string, locked: boolean) => void

  // Alerts
  recomputeAlerts: (todayISO?: string) => void
  dismissAlert: (id: string) => void
  markAlertNotified: (id: string) => void

  // Onboarding (first-run startup screen)
  completeOnboarding: () => void

  // Utility
  seedSample: () => void
  resetAll: () => void
  /** Replace the persisted planner slice wholesale (used by cross-device sync). */
  hydrate: (data: Partial<PersistedState>) => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => {
      const recompute = (todayISO = isoDate()) => {
        const { tasks, budgets, alerts } = get()
        set({ alerts: computeAlerts({ tasks, budgets, todayISO, existing: alerts }) })
      }

      const buildHorizon = (fromISO: string, freshStart: boolean): Record<string, DayPlan> => {
        const s = get()
        const lockedByDate: Record<string, ScheduledBlock[]> = {}
        if (!freshStart) {
          for (const [date, plan] of Object.entries(s.dayPlans)) {
            const locked = plan.blocks.filter((b) => b.locked)
            if (locked.length) lockedByDate[date] = locked
          }
        }
        // Plan far enough to reach the furthest deadline (min 1 week, max ~2 months).
        const offsets = s.tasks
          .filter((t) => !t.completed && t.deadline)
          .map((t) => differenceInCalendarDays(isoToDate(t.deadline!), isoToDate(fromISO)))
        const days = Math.min(60, Math.max(7, (offsets.length ? Math.max(...offsets) : 0) + 1))
        return planHorizon(fromISO, days, {
          tasks: s.tasks,
          recurring: s.recurring,
          events: s.events,
          template: s.template,
          budgets: s.budgets,
          interestKeys: s.interests.map((i) => i.categoryKey),
          hemisphere: s.settings.hemisphere,
          bufferMinutes: s.settings.bufferMinutes,
          lockedByDate,
        })
      }

      return {
        tasks: [],
        recurring: [],
        events: [],
        interests: [],
        template: DEFAULT_TEMPLATE,
        budgets: DEFAULT_BUDGETS,
        settings: DEFAULT_SETTINGS,
        dayPlans: {},
        alerts: [],
        onboarded: false,

        addTask: (t) => {
          const task: Task = {
            id: uid('task'),
            title: t.title.trim() || 'Untitled task',
            notes: t.notes,
            priority: clampPriority(t.priority),
            estimatedMinutes: Math.max(0, t.estimatedMinutes),
            remainingMinutes: Math.max(0, t.estimatedMinutes),
            maxPerDayMinutes: t.maxPerDayMinutes,
            deadline: t.deadline,
            window: cleanWindow(t.window),
            completed: false,
            createdAt: new Date().toISOString(),
          }
          set((s) => ({ tasks: [...s.tasks, task] }))
          recompute()
        },

        updateTask: (id, patch) => {
          set((s) => ({
            tasks: s.tasks.map((task) => {
              if (task.id !== id) return task
              const next = { ...task, ...patch }
              if (patch.priority != null) next.priority = clampPriority(patch.priority)
              if (patch.window !== undefined) next.window = cleanWindow(patch.window)
              // Keep remainingMinutes consistent when the estimate changes.
              if (patch.estimatedMinutes != null && patch.remainingMinutes == null) {
                const done = task.estimatedMinutes - task.remainingMinutes
                next.remainingMinutes = Math.max(0, patch.estimatedMinutes - done)
              }
              return next
            }),
          }))
          recompute()
        },

        deleteTask: (id) => {
          set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
          recompute()
        },

        toggleTaskComplete: (id) => {
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    completed: !t.completed,
                    remainingMinutes: !t.completed ? 0 : t.estimatedMinutes,
                  }
                : t,
            ),
          }))
          recompute()
        },

        addRecurring: (r) => {
          set((s) => ({ recurring: [...s.recurring, { ...r, id: uid('rec') }] }))
        },
        updateRecurring: (id, patch) => {
          set((s) => ({
            recurring: s.recurring.map((r) => (r.id === id ? { ...r, ...patch } : r)),
          }))
        },
        deleteRecurring: (id) => {
          set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) }))
        },

        addEvent: (e) => {
          set((s) => ({ events: [...s.events, { ...e, id: uid('evt') }] }))
          get().replan(isoDate())
        },
        updateEvent: (id, patch) => {
          set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }))
          get().replan(isoDate())
        },
        deleteEvent: (id) => {
          set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
          get().replan(isoDate())
        },

        // --- Calendar import (.ics): implemented by Agent A. ---
        importEvents: (incoming) => {
          set((s) => {
            // Index existing imported events by externalId so a re-import replaces
            // the matching event in place. Manually-added events are left untouched.
            const byExternalId = new Map<string, CalendarEvent>()
            for (const e of s.events) {
              if (e.source === 'import' && e.externalId) byExternalId.set(e.externalId, e)
            }
            for (const e of incoming) {
              const tagged: CalendarEvent = { ...e, id: e.id || uid('evt'), source: 'import' }
              if (tagged.externalId) byExternalId.set(tagged.externalId, tagged)
            }
            // Keep manual events and imported events without an externalId, then
            // append the merged-by-externalId set plus any incoming without an id.
            const kept = s.events.filter((e) => e.source !== 'import' || !e.externalId)
            const appended = incoming
              .filter((e) => !e.externalId)
              .map((e) => ({ ...e, id: e.id || uid('evt'), source: 'import' as const }))
            return { events: [...kept, ...byExternalId.values(), ...appended] }
          })
          get().replan(isoDate())
        },
        clearImportedEvents: () => {
          set((s) => ({ events: s.events.filter((e) => e.source !== 'import') }))
          get().replan(isoDate())
        },

        // --- Interactive suggestions: implemented by Agent B. ---
        proposeForWindow: (dateISO, startMin, endMin) => {
          const gap = endMin - startMin
          if (gap <= 0) return
          // Make sure a plan exists for this day before inserting into it.
          if (!get().dayPlans[dateISO]) get().replan(dateISO)

          const s = get()
          const proposals = suggestForGap(gap, {
            tasks: s.tasks,
            interestKeys: s.interests.map((i) => i.categoryKey),
            date: isoToDate(dateISO),
            hemisphere: s.settings.hemisphere,
          })
          const pick = proposals[0]
          if (!pick) return

          const start = formatTime(startMin)
          const end = formatTime(startMin + pick.durationMinutes)
          const block: ScheduledBlock =
            pick.kind === 'task'
              ? { id: uid('blk'), type: 'task', title: pick.title, start, end, refId: pick.refId, proposed: true }
              : { id: uid('blk'), type: 'free', title: 'Free time', start, end, suggestion: pick.suggestion, proposed: true }

          set((st) => {
            const plan = st.dayPlans[dateISO]
            if (!plan) return {}
            const blocks = [...plan.blocks, block].sort(
              (a, b) => parseTime(a.start) - parseTime(b.start),
            )
            return { dayPlans: { ...st.dayPlans, [dateISO]: { ...plan, blocks } } }
          })
        },
        acceptProposal: (dateISO, blockId) => {
          set((s) => {
            const plan = s.dayPlans[dateISO]
            if (!plan) return {}
            return {
              dayPlans: {
                ...s.dayPlans,
                [dateISO]: {
                  ...plan,
                  blocks: plan.blocks.map((b) =>
                    b.id === blockId ? { ...b, proposed: false, locked: true } : b,
                  ),
                },
              },
            }
          })
        },
        dismissProposal: (dateISO, blockId) => {
          set((s) => {
            const plan = s.dayPlans[dateISO]
            if (!plan) return {}
            return {
              dayPlans: {
                ...s.dayPlans,
                [dateISO]: { ...plan, blocks: plan.blocks.filter((b) => b.id !== blockId) },
              },
            }
          })
        },

        toggleInterest: (categoryKey) => {
          set((s) => {
            const existing = s.interests.find((i) => i.categoryKey === categoryKey)
            if (existing) return { interests: s.interests.filter((i) => i.id !== existing.id) }
            return {
              interests: [
                ...s.interests,
                { id: uid('int'), categoryKey, label: INTEREST_LABEL[categoryKey] ?? categoryKey },
              ],
            }
          })
        },
        addCustomInterest: (label) => {
          const trimmed = label.trim()
          if (!trimmed) return
          const key = trimmed.toLowerCase().replace(/\s+/g, '-')
          set((s) =>
            s.interests.some((i) => i.categoryKey === key)
              ? {}
              : { interests: [...s.interests, { id: uid('int'), categoryKey: key, label: trimmed }] },
          )
        },
        removeInterest: (id) => {
          set((s) => ({ interests: s.interests.filter((i) => i.id !== id) }))
        },

        setSleep: (bedtime, wakeTime) => {
          set((s) => ({ template: { ...s.template, sleep: { bedtime, wakeTime } } }))
        },
        addMeal: () => {
          set((s) => ({
            template: {
              ...s.template,
              meals: [
                ...s.template.meals,
                { id: uid('meal'), name: 'New meal', time: '12:00', durationMinutes: 30 },
              ],
            },
          }))
        },
        updateMeal: (id, patch) => {
          set((s) => ({
            template: {
              ...s.template,
              meals: s.template.meals.map((m) => (m.id === id ? { ...m, ...patch } : m)),
            },
          }))
        },
        removeMeal: (id) => {
          set((s) => ({
            template: { ...s.template, meals: s.template.meals.filter((m) => m.id !== id) },
          }))
        },

        setBudgets: (b) => {
          set((s) => ({ budgets: { ...s.budgets, ...b } }))
          recompute()
        },
        setSettings: (patch) => {
          set((s) => ({ settings: { ...s.settings, ...patch } }))
        },

        replan: (fromISO = isoDate(), freshStart = false) => {
          const horizon = buildHorizon(fromISO, freshStart)
          set((s) => ({ dayPlans: { ...s.dayPlans, ...horizon } }))
        },

        toggleBlockDone: (dateISO, blockId) => {
          set((s) => {
            const plan = s.dayPlans[dateISO]
            if (!plan) return {}
            const block = plan.blocks.find((b) => b.id === blockId)
            if (!block) return {}
            const nowDone = !block.done
            const duration = parseTime(block.end) - parseTime(block.start)
            const blocks = plan.blocks.map((b) => (b.id === blockId ? { ...b, done: nowDone } : b))
            let tasks = s.tasks
            if (block.type === 'task' && block.refId) {
              tasks = s.tasks.map((t) => {
                if (t.id !== block.refId) return t
                const remaining = nowDone
                  ? Math.max(0, t.remainingMinutes - duration)
                  : t.remainingMinutes + duration
                return { ...t, remainingMinutes: remaining, completed: remaining <= 0 }
              })
            }
            return { dayPlans: { ...s.dayPlans, [dateISO]: { ...plan, blocks } }, tasks }
          })
          recompute()
        },

        moveBlock: (dateISO, blockId, newStartMinutes) => {
          set((s) => {
            const plan = s.dayPlans[dateISO]
            if (!plan) return {}
            const blocks = plan.blocks
              .map((b) => {
                if (b.id !== blockId) return b
                const dur = parseTime(b.end) - parseTime(b.start)
                const start = Math.max(0, Math.min(24 * 60 - dur, Math.round(newStartMinutes / 15) * 15))
                return { ...b, start: formatTime(start), end: formatTime(start + dur), locked: true }
              })
              .sort((a, b) => parseTime(a.start) - parseTime(b.start))
            return { dayPlans: { ...s.dayPlans, [dateISO]: { ...plan, blocks } } }
          })
        },

        setBlockLocked: (dateISO, blockId, locked) => {
          set((s) => {
            const plan = s.dayPlans[dateISO]
            if (!plan) return {}
            return {
              dayPlans: {
                ...s.dayPlans,
                [dateISO]: {
                  ...plan,
                  blocks: plan.blocks.map((b) => (b.id === blockId ? { ...b, locked } : b)),
                },
              },
            }
          })
        },

        recomputeAlerts: (todayISO = isoDate()) => recompute(todayISO),
        dismissAlert: (id) => {
          set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)) }))
        },
        markAlertNotified: (id) => {
          set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, notified: true } : a)) }))
        },

        seedSample: () => {
          const today = isoDate()
          const in3 = isoDate(addDays(new Date(), 3))
          const tomorrow = isoDate(addDays(new Date(), 1))
          set({
            tasks: [
              sampleTask('Finish project report', 9, 180, { deadline: in3, maxPerDayMinutes: 90 }),
              sampleTask('Reply to important emails', 6, 45, { deadline: tomorrow }),
              sampleTask('Study for exam', 8, 240, { deadline: in3, maxPerDayMinutes: 120 }),
              sampleTask('Tidy the flat', 3, 60, {}),
            ],
            recurring: [
              {
                id: uid('rec'),
                title: 'Gym',
                category: 'health',
                priority: 6,
                scheduleType: 'flexible',
                timesPerWeek: 3,
                durationMinutes: 60,
                window: { latest: '11:00' },
              },
              {
                id: uid('rec'),
                title: 'Work',
                category: 'commitment',
                priority: 8,
                scheduleType: 'fixed',
                days: [1, 2, 3, 4, 5],
                startTime: '09:00',
                endTime: '17:00',
              },
            ],
            events: [
              {
                id: uid('evt'),
                title: 'Catch-up with a friend',
                date: tomorrow,
                startTime: '16:00',
                endTime: '17:00',
              },
            ],
            interests: ['reading', 'fitness', 'cooking', 'film', 'outdoors'].map((k) => ({
              id: uid('int'),
              categoryKey: k,
              label: INTEREST_LABEL[k] ?? k,
            })),
          })
          recompute(today)
          get().replan(today, true)
        },

        completeOnboarding: () => {
          const today = isoDate()
          set({ onboarded: true })
          recompute(today)
          // Build a clean plan from the inputs the user just provided.
          get().replan(today, true)
        },

        resetAll: () => {
          set({
            tasks: [],
            recurring: [],
            events: [],
            interests: [],
            template: DEFAULT_TEMPLATE,
            budgets: DEFAULT_BUDGETS,
            settings: DEFAULT_SETTINGS,
            dayPlans: {},
            alerts: [],
            // Send the user back through the startup screen after a full reset.
            onboarded: false,
          })
        },

        hydrate: (data) => {
          set((s) => ({
            tasks: data.tasks ?? s.tasks,
            recurring: data.recurring ?? s.recurring,
            events: data.events ?? s.events,
            interests: data.interests ?? s.interests,
            template: data.template ?? s.template,
            budgets: data.budgets ?? s.budgets,
            settings: data.settings ?? s.settings,
            dayPlans: data.dayPlans ?? s.dayPlans,
            alerts: data.alerts ?? s.alerts,
          }))
        },
      }
    },
    {
      name: 'todotoday',
      version: 2,
      partialize: (s) => ({
        tasks: s.tasks,
        recurring: s.recurring,
        events: s.events,
        interests: s.interests,
        template: s.template,
        budgets: s.budgets,
        settings: s.settings,
        dayPlans: s.dayPlans,
        alerts: s.alerts,
        onboarded: s.onboarded,
      }),
      // Anyone with state saved before the startup screen existed has already set
      // the app up, so mark them onboarded. Brand-new installs have no persisted
      // state, so this never runs for them and they start at `onboarded: false`.
      migrate: (persisted, version) => {
        if (version < 2 && persisted && typeof persisted === 'object') {
          return { ...(persisted as Record<string, unknown>), onboarded: true }
        }
        return persisted as PersistedState & { onboarded: boolean }
      },
    },
  ),
)

function clampPriority(p: number): number {
  return Math.max(1, Math.min(10, Math.round(p || 1)))
}

function cleanWindow(w?: TimeWindow): TimeWindow | undefined {
  if (!w) return undefined
  const out: TimeWindow = {}
  if (w.earliest) out.earliest = w.earliest
  if (w.latest) out.latest = w.latest
  return out.earliest || out.latest ? out : undefined
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

function sampleTask(
  title: string,
  priority: number,
  estimatedMinutes: number,
  extra: Partial<Task>,
): Task {
  return {
    id: uid('task'),
    title,
    priority,
    estimatedMinutes,
    remainingMinutes: estimatedMinutes,
    completed: false,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}
