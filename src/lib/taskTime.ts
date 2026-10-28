import type { Task } from '../../shared/types'

// 結束時間不晚於開始時間，就當作隔天結束（例如 22:00–02:00）
export const isOvernight = (t: Pick<Task, 'startTime' | 'endTime'>) =>
  !!t.startTime && !!t.endTime && t.endTime <= t.startTime

/** 任務的時間文字：「09:00」「09:00–10:30」「22:00–隔天 02:00」 */
export function taskTimeLabel(t: Pick<Task, 'startTime' | 'endTime'>) {
  if (!t.startTime) return ''
  if (!t.endTime) return t.startTime
  return `${t.startTime}–${isOvernight(t) ? '隔天 ' : ''}${t.endTime}`
}
