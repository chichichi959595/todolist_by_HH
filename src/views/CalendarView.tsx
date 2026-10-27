import type {
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
  EventMountArg,
} from '@fullcalendar/core'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type DateClickArg, type EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { addDays, format, parseISO } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { courseOccurrences } from '../../shared/courses'
import type { TaskUpdateInput } from '../../shared/schemas'
import type { Course, CourseSession, Task } from '../../shared/types'
import RubberSegment from '../components/reactbits/RubberSegment'
import { CourseDialog } from '../components/CourseDialog'
import { CourseDetail, TaskDetail } from '../components/DetailCards'
import { PlusIcon } from '../components/icons'
import { TaskDialog } from '../components/TaskDialog'
import { useCourseColor } from '../lib/courses'
import { PRIORITIES, toDateStr, todayStr, WEEKDAY_LABELS } from '../lib/date'
import { useCategories, useCourses, useRangeTasks, useTaskMutations } from '../lib/queries'

const VIEWS = 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'

// 桌面版右上角的切換：React Bits 的 RubberSegment，順序是日、週、月、清單
const MODE_ITEMS = [
  { value: 'timeGridDay', label: '日' },
  { value: 'timeGridWeek', label: '週' },
  { value: 'dayGridMonth', label: '月' },
  { value: 'listWeek', label: '清單' },
]

// 週曆／日曆只顯示 09:00 到 24:00，而且不顯示全天列
const DAY_START = '09:00'
const DAY_END = '24:00'

// 標題依實際的欄位產生
type TitleArg = { start: { marker: Date } }
// marker 用 UTC 欄位存「當地牆上時間」
const markerToDate = (m: Date) => new Date(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate())

const weekTitle = (short: boolean) => ({ start }: TitleArg) => {
  const from = markerToDate(start.marker)
  const to = addDays(from, 6)
  if (short) return `${format(from, 'M/d')} – ${format(to, 'M/d')}`
  return `${format(from, 'yyyy年M月d日')} – ${format(to, from.getMonth() === to.getMonth() ? 'd日' : 'M月d日')}`
}

const dayTitle = (short: boolean) => ({ start }: TitleArg) =>
  format(markerToDate(start.marker), short ? 'M/d（EEEEE）' : 'yyyy年M月d日 EEEE', { locale: zhTW })

function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(max-width: 640px)')
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia('(max-width: 640px)').matches,
  )
}

/** 右邊欄正在看的項目：任務看 id；課是「哪門課、哪天、哪個時段」 */
type Picked =
  | { kind: 'task'; id: number }
  | { kind: 'course'; id: number; date: string; startTime: string; endTime: string }
  | null

function isPicked(picked: Picked, props: Record<string, unknown>) {
  if (!picked) return false
  if (picked.kind === 'task') return (props.task as Task | undefined)?.id === picked.id
  const course = props.course as Course | undefined
  const session = props.session as CourseSession | undefined
  return course?.id === picked.id && props.date === picked.date && session?.startTime === picked.startTime
}

interface CalendarViewProps {
  /** FullCalendar 的 view type，由外層控制（導覽列的「日曆」鍵會切換月／週） */
  mode: string
  onModeChange: (mode: string) => void
}

export function CalendarView({ mode, onModeChange }: CalendarViewProps) {
  const isMobile = useIsMobile()
  const calendarRef = useRef<FullCalendar>(null)
  const [range, setRange] = useState<{ from: string; to: string } | null>(null)
  const [dialog, setDialog] = useState<{ task: Task | null } | null>(null)
  // 右邊欄：點了哪一天（預設今天），以及點了哪個項目
  const [day, setDay] = useState(todayStr)
  const [picked, setPicked] = useState<Picked>(null)

  const { data: tasks = [] } = useRangeTasks(range)
  const { data: courses = [] } = useCourses()
  const { data: categories = [] } = useCategories()
  const courseColor = useCourseColor()
  const [courseDialog, setCourseDialog] = useState<Course | null>(null)
  const { update } = useTaskMutations()

  // 外層切換檢視時同步到 FullCalendar
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (api && api.view.type !== mode) api.changeView(mode)
  }, [mode])

  const events = useMemo<EventInput[]>(() => {
    const timeGrid = mode.startsWith('timeGrid')
    const spansPerDay = new Map<string, number>()
    const taskEvents: EventInput[] = tasks
      .filter((t) => t.date)
      .map((t) => {
        const base = {
          id: `t-${t.id}`,
          // 有分類用分類的顏色，沒有就用重要程度的顏色
          color:
            categories.find((c) => c.id === t.categoryId)?.color ??
            PRIORITIES[t.priority]?.event ??
            PRIORITIES[0].event,
          classNames: t.done ? ['is-done'] : [],
          extendedProps: { task: t },
        }
        // 週／日檢視沒有全天列：全天任務、以及 09:00 前開始的任務，
        // 畫成墊在後面的淡色整條（不佔欄寬），標題放在最上面
        if (timeGrid && (!t.startTime || t.startTime < DAY_START)) {
          const spanIndex = spansPerDay.get(t.date!) ?? 0
          spansPerDay.set(t.date!, spanIndex + 1)
          return {
            ...base,
            title: t.startTime ? `${t.startTime} ${t.title}` : t.title,
            start: `${t.date}T${DAY_START}`,
            end: `${toDateStr(addDays(parseISO(t.date!), 1))}T00:00`,
            display: 'background',
            classNames: [...base.classNames, 'is-span'],
            extendedProps: { task: t, spanIndex },
          }
        }
        return {
          ...base,
          title: t.title,
          start: t.startTime ? `${t.date}T${t.startTime}` : t.date!,
          end: t.startTime && t.endTime ? `${t.date}T${t.endTime}` : undefined,
          allDay: !t.startTime,
        }
      })
    if (!range) return taskEvents

    // 課表：有效期間內每週固定的課，不能拖，點了打開課程
    const courseEvents: EventInput[] = courseOccurrences(courses, range.from, range.to).map((o, i) => ({
      id: `c-${o.course.id}-${o.date}-${o.session.startTime}-${i}`,
      title: o.course.location ? `${o.course.name}（${o.course.location}）` : o.course.name,
      start: `${o.date}T${o.session.startTime}`,
      end: `${o.date}T${o.session.endTime}`,
      color: courseColor(o.course),
      editable: false,
      classNames: ['is-course'],
      extendedProps: { course: o.course, date: o.date, session: o.session },
    }))
    return [...courseEvents, ...taskEvents]
  }, [tasks, courses, categories, courseColor, range, mode])

  function handleDatesSet(info: DatesSetArg) {
    // FullCalendar 的 end 是不含的那一天
    setRange({ from: toDateStr(info.start), to: toDateStr(addDays(info.end, -1)) })
    if (info.view.type !== mode) onModeChange(info.view.type)
  }

  // 點日曆上的空白處（時段或日期格）只是選那一天，右邊欄列出那天的東西；不再直接新增
  function handleDateClick(info: DateClickArg) {
    setDay(toDateStr(info.date))
    setPicked(null)
  }

  function pickTask(task: Task) {
    if (task.date) setDay(task.date)
    setPicked({ kind: 'task', id: task.id })
  }

  // 背景事件不會觸發 eventClick，自己接標題的點擊；擋掉 pointerdown，避免同時觸發框選新增
  function handleEventMount(info: EventMountArg) {
    // 區塊太窄時標題會被截斷，滑過顯示完整標題
    if (info.event.title) info.el.title = info.event.title
    if (info.event.display !== 'background') return
    const task = info.event.extendedProps.task as Task | undefined
    const title = info.el.querySelector<HTMLElement>('.fc-event-title')
    info.el.style.setProperty('--span-color', info.backgroundColor)
    info.el.style.setProperty('--span-index', String(info.event.extendedProps.spanIndex ?? 0))
    if (!task || !title) return
    title.setAttribute('role', 'button')
    title.tabIndex = 0
    const open = () => pickTask(task)
    title.addEventListener('pointerdown', (e) => e.stopPropagation())
    title.addEventListener('mousedown', (e) => e.stopPropagation())
    title.addEventListener('click', open)
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      }
    })
  }

  function handleEventClick(info: EventClickArg) {
    const task = info.event.extendedProps.task as Task | undefined
    const course = info.event.extendedProps.course as Course | undefined
    if (task) pickTask(task)
    else if (course) {
      const { date, session } = info.event.extendedProps as { date: string; session: CourseSession }
      setDay(date)
      setPicked({ kind: 'course', id: course.id, date, startTime: session.startTime, endTime: session.endTime })
    }
  }

  // 拖拉或調整長度後更新日期 / 時間
  function handleMove(info: EventDropArg | EventResizeDoneArg) {
    const task = info.event.extendedProps.task as Task | undefined
    const start = info.event.start
    if (!task || !start) return info.revert()

    const end = info.event.end
    const date = toDateStr(start)
    // 週／日檢視裡整條顯示的全天任務，只改日期
    if (!task.startTime) {
      if (date === task.date) return info.revert()
      return update.mutate({ id: task.id, patch: { date } }, { onError: () => info.revert() })
    }
    const patch: TaskUpdateInput = info.event.allDay
      ? { date, startTime: null, endTime: null }
      : {
          date,
          startTime: format(start, 'HH:mm'),
          // 原本沒有結束時間、只是被拖動的任務，維持沒有結束時間；跨日的話也不存
          endTime:
            !task.endTime && !('endDelta' in info)
              ? null
              : end && toDateStr(end) === date
                ? format(end, 'HH:mm')
                : null,
        }
    update.mutate({ id: task.id, patch }, { onError: () => info.revert() })
  }

  // 桌面版的日／週／月／清單切換，左右並排時放在右邊欄、新增任務的左邊
  const modeSwitch = (
    <RubberSegment
      className="w-full"
      items={MODE_ITEMS}
      value={mode}
      onChange={(next) => calendarRef.current?.getApi().changeView(next)}
      trackColor="var(--muted)"
      thumbColor="var(--primary)"
      textColor="var(--foreground)"
      activeTextColor="var(--primary-foreground)"
      radius={12}
      aria-label="日曆檢視"
    />
  )

  return (
    <div className="flex h-full flex-col px-3 py-3 md:px-8 md:py-4">
      <h1 className="sr-only">日曆</h1>
      {/* 跟課表一樣：左邊日曆、右邊資訊欄。看卡片自己的寬度決定並排或上下排 */}
      <div className="cal-card @container flex min-h-0 flex-1 flex-col rounded-2xl border bg-card p-2.5 text-card-foreground shadow-xs md:overflow-y-auto md:p-6">
        <div className="flex min-h-0 flex-1 flex-col gap-6 @min-[900px]:flex-row">
        <div className="relative flex min-h-[640px] min-w-0 flex-1 flex-col @min-[900px]:min-h-0">
        {/* 上下排（卡片窄）時切換疊在 FullCalendar 工具列右邊留空的位置；左右並排時移到右邊欄最上面 */}
        {!isMobile && (
          <div className="absolute top-0 right-0 z-10 w-(--cal-segment-w) @min-[900px]:hidden">{modeSwitch}</div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={zhTwLocale}
          initialView={mode}
          headerToolbar={
            isMobile
              ? { left: 'prev,next', center: 'title', right: 'today' }
              : { left: 'prev,next today', center: 'title', right: '' }
          }
          footerToolbar={isMobile ? { center: VIEWS } : undefined}
          buttonText={{ today: '今天', month: '月', week: '週', day: '日', list: '清單' }}
          height="100%"
          firstDay={1}
          nowIndicator
          dayMaxEvents
          editable
          slotMinTime={DAY_START}
          slotMaxTime={DAY_END}
          slotDuration="01:00:00"
          snapDuration="00:15:00"
          expandRows
          eventMinHeight={12}
          slotEventOverlap={false}
          views={{
            timeGrid: { allDaySlot: false },
            timeGridDay: { titleFormat: dayTitle(isMobile) },
            timeGridWeek: {
              titleFormat: weekTitle(isMobile),
              dayHeaderContent: isMobile
                ? ({ date }) => (
                    <span className="flex flex-col leading-tight">
                      <span>{WEEKDAY_LABELS[date.getDay()]}</span>
                      <span className="tabular-nums">{date.getDate()}</span>
                    </span>
                  )
                : undefined,
            },
          }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          events={events}
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          dayCellClassNames={({ date }) => (toDateStr(date) === day ? ['is-picked'] : [])}
          eventClassNames={({ event }) => (isPicked(picked, event.extendedProps) ? ['is-picked'] : [])}
          eventClick={handleEventClick}
          eventDidMount={handleEventMount}
          eventDrop={handleMove}
          eventResize={handleMove}
        />
        </div>

        <DayPanel
          day={day}
          picked={picked}
          tasks={tasks}
          courses={courses}
          onPick={setPicked}
          onNewTask={() => setDialog({ task: null })}
          onEditTask={(task) => setDialog({ task })}
          onEditCourse={setCourseDialog}
          modeSwitch={isMobile ? null : modeSwitch}
        />
        </div>
      </div>

      <CourseDialog open={courseDialog !== null} onClose={() => setCourseDialog(null)} course={courseDialog} />
      <TaskDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        task={dialog?.task}
        defaults={{ date: day }}
      />
    </div>
  )
}

/** 日曆右邊欄：上面是點到的項目詳情，下面是選到那天的課和任務 */
function DayPanel({
  day,
  picked,
  tasks,
  courses,
  onPick,
  onNewTask,
  onEditTask,
  onEditCourse,
  modeSwitch,
}: {
  modeSwitch: ReactNode
  day: string
  picked: Picked
  tasks: Task[]
  courses: Course[]
  onPick: (picked: Picked) => void
  onNewTask: () => void
  onEditTask: (task: Task) => void
  onEditCourse: (course: Course) => void
}) {
  const { data: categories = [] } = useCategories()
  const courseColor = useCourseColor()
  const taskColor = (t: Task) =>
    categories.find((c) => c.id === t.categoryId)?.color ?? PRIORITIES[t.priority]?.event ?? PRIORITIES[0].event

  // 那天的課和任務排在一起，全天的在最前面，其他照開始時間
  const rows = [
    ...courseOccurrences(courses, day, day).map((o) => ({
      key: `c-${o.course.id}-${o.session.startTime}`,
      start: o.session.startTime,
      time: `${o.session.startTime}–${o.session.endTime}`,
      title: o.course.name,
      sub: o.course.location,
      color: courseColor(o.course),
      done: false,
      active: picked?.kind === 'course' && picked.id === o.course.id && picked.date === day && picked.startTime === o.session.startTime,
      pick: { kind: 'course', id: o.course.id, date: day, startTime: o.session.startTime, endTime: o.session.endTime } as Picked,
    })),
    ...tasks
      .filter((t) => t.date === day)
      .map((t) => ({
        key: `t-${t.id}`,
        start: t.startTime ?? '',
        time: t.startTime ? `${t.startTime}${t.endTime ? `–${t.endTime}` : ''}` : '全天',
        title: t.title,
        sub: null as string | null,
        color: taskColor(t),
        done: t.done,
        active: picked?.kind === 'task' && picked.id === t.id,
        pick: { kind: 'task', id: t.id } as Picked,
      })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  // 卡片窄、這欄排到日曆下面時，點了東西要捲過來才看得到
  const panelRef = useRef<HTMLElement>(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const el = panelRef.current
    if (el && el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [day, picked])

  const task = picked?.kind === 'task' ? tasks.find((t) => t.id === picked.id) : undefined
  const course = picked?.kind === 'course' ? courses.find((c) => c.id === picked.id) : undefined

  return (
    <section ref={panelRef} aria-label="這天的資訊" className="@min-[900px]:w-80 @min-[900px]:shrink-0 @min-[900px]:overflow-y-auto">
      {/* 新增任務和其他頁面一樣大、一樣在右上角；並排時左邊放檢視切換 */}
      <div className="mb-4 flex items-center justify-end gap-2">
        {modeSwitch && <div className="hidden min-w-0 flex-1 @min-[900px]:block">{modeSwitch}</div>}
        <Button onClick={onNewTask} className="shrink-0">
          <PlusIcon />
          新增任務
        </Button>
      </div>

      {task && <TaskDetail task={task} onEdit={() => onEditTask(task)} className="mb-6" />}
      {course && picked?.kind === 'course' && (
        <CourseDetail
          course={course}
          date={picked.date}
          startTime={picked.startTime}
          endTime={picked.endTime}
          onEdit={() => onEditCourse(course)}
          className="mb-6"
        />
      )}

      <h2 className="mb-3 flex items-baseline gap-2 px-1 text-lg font-medium tracking-tight">
        {format(parseISO(day), 'M月d日 EEEE', { locale: zhTW })}
        {rows.length > 0 && <span className="text-[13px] font-medium text-muted-foreground">{rows.length}</span>}
      </h2>
      {rows.length === 0 ? (
        <p className="px-1 text-muted-foreground">這天沒有課也沒有任務</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => onPick(r.pick)}
                aria-pressed={r.active}
                className={`flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60 ${
                  r.active ? 'bg-muted' : ''
                }`}
              >
                <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-medium ${r.done ? 'text-muted-foreground line-through' : ''}`}>
                    {r.title}
                  </span>
                  <span className="block text-[13px] text-muted-foreground tabular-nums">
                    {r.time}
                    {r.sub && ` · ${r.sub}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

