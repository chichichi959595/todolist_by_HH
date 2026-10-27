import { addDays, parseISO } from 'date-fns'
import { toDateStr } from './habits'
import type { Course, CourseSession } from './types'

/** 課表的時間範圍：上課時間要在這之間 */
export const COURSE_DAY_START = '09:10'
export const COURSE_DAY_END = '21:10'

export interface CourseOccurrence {
  course: Course
  session: CourseSession
  date: string
}

/** 這天在課程的有效期間內 */
export const isCourseActive = (course: Pick<Course, 'startDate' | 'endDate'>, date: string) =>
  course.startDate <= date && date <= course.endDate

/** 展開 from–to（含）之間每一堂課，依日期、時間排序 */
export function courseOccurrences(courses: Course[], from: string, to: string): CourseOccurrence[] {
  const result: CourseOccurrence[] = []
  for (let d = parseISO(from); toDateStr(d) <= to; d = addDays(d, 1)) {
    const date = toDateStr(d)
    const weekday = d.getDay()
    for (const course of courses) {
      if (!isCourseActive(course, date)) continue
      for (const session of course.sessions) {
        if (session.weekday === weekday) result.push({ course, session, date })
      }
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.session.startTime.localeCompare(b.session.startTime))
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

type CourseShape = Pick<Course, 'name' | 'sessions' | 'startDate' | 'endDate'>

const sessionsOverlap = (a: CourseSession, b: CourseSession) =>
  a.weekday === b.weekday && a.startTime < b.endTime && b.startTime < a.endTime

const describe = (s: CourseSession) => `${WEEKDAY_NAMES[s.weekday]} ${s.startTime}–${s.endTime}`

/**
 * 課表不能重疊：同一個時間只能上一堂課。
 * 自己的時段互相重疊、或和有效期間重疊的其他課程撞到時段，回傳錯誤訊息；沒問題回傳 null。
 */
export function findCourseConflict(course: CourseShape, others: CourseShape[]): string | null {
  for (let i = 0; i < course.sessions.length; i++) {
    for (let j = i + 1; j < course.sessions.length; j++) {
      if (sessionsOverlap(course.sessions[i], course.sessions[j])) {
        return `上課時間重複：${describe(course.sessions[i])} 和 ${describe(course.sessions[j])}`
      }
    }
  }
  for (const other of others) {
    if (other.endDate < course.startDate || course.endDate < other.startDate) continue
    for (const a of course.sessions) {
      const b = other.sessions.find((s) => sessionsOverlap(a, s))
      if (b) return `和「${other.name}」的上課時間衝突（${describe(b)}）`
    }
  }
  return null
}
