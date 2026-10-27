import { addDays, format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import type { ReactNode } from 'react'
import { SquarePenIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { weekStart } from '../../shared/habits'
import type { Course, HabitWithStats, Task } from '../../shared/types'
import { useCourseColor } from '../lib/courses'
import { PRIORITIES, toDateStr, WEEKDAY_LABELS, WEEKDAY_ORDER } from '../lib/date'
import { useCategories } from '../lib/queries'
import { frequencyLabel } from './HabitDialog'
import { NoteIcon, PencilIcon } from './icons'

/* 右邊欄的資訊卡：日曆、習慣、今天頁共用，同一種東西在哪一頁看起來都一樣 */

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-12 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

/** 任務的顏色：有分類用分類的顏色，沒有就用重要程度的顏色 */
export function useTaskColor() {
  const { data: categories = [] } = useCategories()
  return (t: Task) =>
    categories.find((c) => c.id === t.categoryId)?.color ?? PRIORITIES[t.priority]?.event ?? PRIORITIES[0].event
}

export function TaskDetail({ task, onEdit, className }: { task: Task; onEdit: () => void; className?: string }) {
  const { data: categories = [] } = useCategories()
  const taskColor = useTaskColor()
  const category = categories.find((c) => c.id === task.categoryId)
  return (
    <div className={cn('rounded-xl border p-4', className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: taskColor(task) }} />
        <h3 className={`min-w-0 flex-1 font-medium break-words ${task.done ? 'text-muted-foreground line-through' : ''}`}>
          {task.title}
        </h3>
      </div>
      <dl className="mt-3 grid gap-1.5 text-[13px] tabular-nums">
        <Info label="時間">
          {task.date ? format(parseISO(task.date), 'M/d（EEEEE）', { locale: zhTW }) : '未排程'}{' '}
          {task.date && (task.startTime ? `${task.startTime}${task.endTime ? `–${task.endTime}` : ''}` : '全天')}
        </Info>
        {category && <Info label="分類">{category.name}</Info>}
        {task.priority > 0 && <Info label="重要程度">{PRIORITIES[task.priority]?.label}</Info>}
        {task.done && <Info label="狀態">已完成</Info>}
      </dl>
      {task.notes && (
        <p className="mt-3 flex gap-1.5 text-[13px] whitespace-pre-wrap text-muted-foreground">
          <NoteIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0 break-words">{task.notes}</span>
        </p>
      )}
      <Button variant="outline" size="sm" onClick={onEdit} className="mt-4 w-full">
        <PencilIcon />
        編輯任務
      </Button>
    </div>
  )
}

export function CourseDetail({
  course,
  date,
  startTime,
  endTime,
  onEdit,
  className,
}: {
  course: Course
  date: string
  startTime: string
  endTime: string
  onEdit: () => void
  className?: string
}) {
  const courseColor = useCourseColor()
  return (
    <div className={cn('rounded-xl border p-4', className)}>
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: courseColor(course) }} />
        <h3 className="min-w-0 flex-1 font-medium break-words">{course.name}</h3>
      </div>
      <dl className="mt-3 grid gap-1.5 text-[13px] tabular-nums">
        <Info label="時段">
          {format(parseISO(date), 'M/d（EEEEE）', { locale: zhTW })} {startTime}–{endTime}
        </Info>
        {course.location && <Info label="教室">{course.location}</Info>}
      </dl>
      <Button variant="outline" size="sm" onClick={onEdit} className="mt-4 w-full">
        <PencilIcon />
        編輯課程
      </Button>
    </div>
  )
}

/** 最近幾週的打卡格子：一列一週（一到日），有打卡就塗上習慣的顏色 */
const RECENT_WEEKS = 6

export function HabitDetail({ habit, today, onEdit }: { habit: HabitWithStats; today: string; onEdit: () => void }) {
  const unit = habit.frequency === 'weekly' ? '週' : '天'
  const logged = new Set(habit.logs)
  const first = addDays(weekStart(new Date()), -7 * (RECENT_WEEKS - 1))
  const days = Array.from({ length: RECENT_WEEKS * 7 }, (_, i) => addDays(first, i))
  const recentCount = days.filter((d) => logged.has(toDateStr(d))).length

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 size-5 shrink-0 rounded-full" style={{ background: habit.color }} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold break-words">{habit.name}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{frequencyLabel(habit)}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="編輯習慣" title="編輯習慣">
          <SquarePenIcon size={16} strokeWidth={1.75} />
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: '目前連續', value: habit.currentStreak, suffix: unit },
          { label: '最長連續', value: habit.longestStreak, suffix: unit },
          { label: '總共', value: habit.total, suffix: '次' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/60 px-2 py-2.5">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">
              {s.value}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">{s.suffix}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* 右邊欄排到下面變寬時，格子不要跟著撐大 */}
      <div className="mt-5 max-w-sm">
        <div className="mb-2 flex items-baseline justify-between text-[13px]">
          <span className="font-medium">最近 {RECENT_WEEKS} 週</span>
          <span className="text-muted-foreground tabular-nums">打卡 {recentCount} 次</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground" aria-hidden="true">
          {WEEKDAY_ORDER.map((d) => (
            <span key={d}>{WEEKDAY_LABELS[d]}</span>
          ))}
        </div>
        <ol className="mt-1 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = toDateStr(d)
            const done = logged.has(key)
            const future = key > today
            return (
              <li
                key={key}
                title={`${format(d, 'M/d')}${done ? ' 已打卡' : ''}`}
                aria-label={`${format(d, 'M月d日')}${done ? '，已打卡' : future ? '' : '，沒有打卡'}`}
                className={cn(
                  'aspect-square rounded-md',
                  !done && (future ? 'border border-dashed' : 'bg-muted'),
                  key === today && 'ring-2 ring-foreground ring-offset-1 ring-offset-card',
                )}
                style={done ? { background: habit.color } : undefined}
              />
            )
          })}
        </ol>
      </div>
    </div>
  )
}
