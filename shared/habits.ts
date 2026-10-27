import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import type { Habit, HabitStats } from './types'

export const WEEK_STARTS_ON = 1 // 週一開始

export function toDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function weekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON })
}

/** 這天是不是排定要做的日子（weekly 型每天都可以做） */
export function isScheduled(habit: Pick<Habit, 'frequency' | 'weekdays'>, date: Date): boolean {
  if (habit.frequency === 'weekdays') return ((habit.weekdays >> date.getDay()) & 1) === 1
  return true
}

/**
 * 計算連續紀錄。
 * - daily / weekdays：排定日沒打卡就中斷；非排定日跳過；今天還沒打卡不算中斷。
 * - weekly：以週為單位，達標週數連續；本週還沒達標不算中斷。
 */
export function computeHabitStats(
  habit: Pick<Habit, 'frequency' | 'weekdays' | 'weeklyTarget'>,
  logs: string[],
  today: string,
): HabitStats {
  const todayDate = parseISO(today)
  const thisWeekKey = toDateStr(weekStart(todayDate))

  const weekCounts = new Map<string, number>()
  for (const d of logs) {
    const key = toDateStr(weekStart(parseISO(d)))
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1)
  }

  const stats: HabitStats = {
    currentStreak: 0,
    longestStreak: 0,
    total: logs.length,
    thisWeek: weekCounts.get(thisWeekKey) ?? 0,
  }
  if (logs.length === 0) return stats

  const first = parseISO([...logs].sort()[0])
  let run = 0

  if (habit.frequency === 'weekly') {
    for (let w = weekStart(first); w <= todayDate; w = addDays(w, 7)) {
      const key = toDateStr(w)
      if ((weekCounts.get(key) ?? 0) >= habit.weeklyTarget) {
        run++
        stats.longestStreak = Math.max(stats.longestStreak, run)
      } else if (key !== thisWeekKey) {
        run = 0
      }
    }
  } else {
    const logSet = new Set(logs)
    for (let d = first; d <= todayDate; d = addDays(d, 1)) {
      const key = toDateStr(d)
      if (logSet.has(key)) {
        run++
        stats.longestStreak = Math.max(stats.longestStreak, run)
      } else if (isScheduled(habit, d) && key !== today) {
        run = 0
      }
    }
  }

  stats.currentStreak = run
  return stats
}
