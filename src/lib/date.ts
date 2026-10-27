import { format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { toDateStr } from '../../shared/habits'

export { toDateStr }

export const todayStr = () => toDateStr(new Date())

export const formatLong = (date: Date) => format(date, 'M月d日 EEEE', { locale: zhTW })

export const formatShort = (date: string) => format(parseISO(date), 'M/d（EEEEE）', { locale: zhTW })

/** 依 JS getDay() 排列（0 = 日） */
export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
/** 週一開始的顯示順序 */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const PRIORITIES = [
  { value: 0, label: '無', color: 'var(--muted-foreground)', event: '#5b6472' },
  { value: 1, label: '低', color: '#0ea5e9', event: '#0284c7' },
  { value: 2, label: '中', color: '#f59e0b', event: '#d97706' },
  { value: 3, label: '高', color: '#f43f5e', event: '#e11d48' },
] as const
