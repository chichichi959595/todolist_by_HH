export type Priority = 0 | 1 | 2 | 3

export interface Task {
  id: number
  title: string
  notes: string
  date: string | null
  startTime: string | null
  endTime: string | null
  priority: number
  categoryId: number | null
  done: boolean
  completedAt: string | null
  createdAt: string
}

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly'

export interface Habit {
  id: number
  name: string
  color: string
  frequency: HabitFrequency
  weekdays: number
  weeklyTarget: number
  archived: boolean
  sortOrder: number
  createdAt: string
}

export interface HabitStats {
  /** daily / weekdays 單位是「次」，weekly 單位是「週」 */
  currentStreak: number
  longestStreak: number
  total: number
  thisWeek: number
}

export interface HabitWithStats extends Habit, HabitStats {
  logs: string[]
}

export interface CourseSession {
  /** 0 = 星期日 … 6 = 星期六 */
  weekday: number
  startTime: string
  endTime: string
}

export interface Course {
  id: number
  name: string
  location: string
  color: string
  sessions: CourseSession[]
  startDate: string
  endDate: string
  createdAt: string
}

/** 學期期間：新增課程時預設用這段日期 */
export interface Semester {
  startDate: string
  endDate: string
}

export interface Category {
  id: number
  name: string
  color: string
  courseId: number | null
  sortOrder: number
  createdAt: string
}
