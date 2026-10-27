import { useState, type CSSProperties, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { courseOccurrences } from '../../shared/courses'
import { isScheduled } from '../../shared/habits'
import type { Course, HabitWithStats, Task } from '../../shared/types'
import { FactCushions } from '../components/blocks'
import { CourseDialog } from '../components/CourseDialog'
import { CourseDetail, HabitDetail, TaskDetail } from '../components/DetailCards'
import { frequencyLabel, HabitDialog } from '../components/HabitDialog'
import { PlusIcon } from '../components/icons'
import { TaskDialog } from '../components/TaskDialog'
import { CheckBox, TaskItem, useCheckAnimation } from '../components/TaskItem'
import { mix } from '../lib/spring'
import { useCourseColor } from '../lib/courses'
import { formatLong, todayStr } from '../lib/date'
import { storage } from '../lib/storage'
import { useCourses, useHabitMutations, useHabits, useTodayTasks } from '../lib/queries'

type Panel = 'tasks' | 'habits' | 'courses' | 'overdue' | 'inbox'
/** 右邊欄正在看的那一項 */
type Pick = { kind: 'task'; id: number } | { kind: 'habit'; id: number } | { kind: 'course'; id: number; start: string }
const samePick = (a: Pick | null, b: Pick) =>
  a !== null && a.kind === b.kind && a.id === b.id && (a.kind !== 'course' || (b.kind === 'course' && a.start === b.start))
const PANELS: Panel[] = ['tasks', 'habits', 'courses', 'overdue', 'inbox']
const PANEL_TITLES: Record<Panel, string> = {
  tasks: '今日任務',
  habits: '今日習慣',
  courses: '今日課程',
  overdue: '逾期',
  inbox: '未排程',
}

export function TodayView() {
  const today = todayStr()
  const { data: tasks = [], isPending } = useTodayTasks(today)
  const { data: habits = [] } = useHabits(today)
  const { data: courses = [] } = useCourses()
  const todayClasses = courseOccurrences(courses, today, today)
  const courseColor = useCourseColor()

  const [editing, setEditing] = useState<Task | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<HabitWithStats | null>(null)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [picked, setPicked] = useState<Pick | null>(null)
  // 上面的墊子選哪個，下面就顯示哪個清單；記住上次選的
  const [panel, setPanel] = useState<Panel>(() => {
    const saved = storage.get('today.panel') as Panel | null
    return saved && PANELS.includes(saved) ? saved : 'tasks'
  })

  function selectPanel(next: Panel) {
    setPanel(next)
    storage.set('today.panel', next)
  }

  // 逾期、未排程裡已完成的，是今天才完成的（伺服器只回這些）
  const overdue = tasks.filter((t) => t.date !== null && t.date < today && !t.done)
  const overdueDone = tasks.filter((t) => t.date !== null && t.date < today && t.done)
  const todayOpen = tasks.filter((t) => t.date === today && !t.done)
  const todayDone = tasks.filter((t) => t.date === today && t.done)
  const inbox = tasks.filter((t) => t.date === null && !t.done)
  const inboxDone = tasks.filter((t) => t.date === null && t.done)
  const todayHabits = habits.filter((h) => !h.archived && isScheduled(h, new Date()))

  const totalToday = todayOpen.length + todayDone.length
  const habitsDoneList = todayHabits.filter((h) => h.logs.includes(today))
  const habitsOpen = todayHabits.filter((h) => !h.logs.includes(today))
  const habitsDone = habitsDoneList.length

  function openTask(task: Task | null) {
    setEditing(task)
    setDialogOpen(true)
  }

  // 這個墊子底下可以選的項目（照畫面順序）；點過的那個不在這裡，就顯示第一個
  const taskPick = (t: Task): Pick => ({ kind: 'task', id: t.id })
  const candidates: Record<Panel, Pick[]> = {
    tasks: [...todayOpen, ...todayDone].map(taskPick),
    habits: [...habitsOpen, ...habitsDoneList].map((h) => ({ kind: 'habit', id: h.id })),
    courses: todayClasses.map((o) => ({ kind: 'course', id: o.course.id, start: o.session.startTime })),
    overdue: [...overdue, ...overdueDone].map(taskPick),
    inbox: [...inbox, ...inboxDone].map(taskPick),
  }
  const current = candidates[panel].find((c) => samePick(picked, c)) ?? candidates[panel][0] ?? null
  const sel = { current, pick: setPicked }

  const empty = (text: string) => <p className="px-3 py-2 text-muted-foreground">{text}</p>

  // 右邊欄：選到的那一項的資訊，跟日曆、習慣頁用同一套資訊卡
  function renderDetail() {
    if (!current) return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">這裡沒有項目</p>
    if (current.kind === 'task') {
      const task = tasks.find((t) => t.id === current.id)
      return task && <TaskDetail task={task} onEdit={() => openTask(task)} />
    }
    if (current.kind === 'habit') {
      const habit = todayHabits.find((h) => h.id === current.id)
      return habit && <HabitDetail habit={habit} today={today} onEdit={() => setEditingHabit(habit)} />
    }
    const o = todayClasses.find((x) => x.course.id === current.id && x.session.startTime === current.start)
    return (
      o && (
        <CourseDetail
          course={o.course}
          date={today}
          startTime={o.session.startTime}
          endTime={o.session.endTime}
          onEdit={() => setEditingCourse(o.course)}
        />
      )
    )
  }

  function renderPanel() {
    if (isPending && panel !== 'courses' && panel !== 'habits') return empty('載入中…')
    switch (panel) {
      // 上面未完成、一條線、下面已完成（劃掉但留著）
      case 'tasks':
        return (
          <Split
            open={todayOpen.length === 0 ? empty(todayDone.length > 0 ? '今天的任務都完成了' : '今天還沒有任務') : <TaskList tasks={todayOpen} sel={sel} onEdit={openTask} />}
            doneCount={todayDone.length}
            done={<TaskList tasks={todayDone} sel={sel} onEdit={openTask} />}
          />
        )
      case 'habits':
        return todayHabits.length === 0 ? (
          empty('今天沒有要做的習慣')
        ) : (
          <Split
            open={habitsOpen.length === 0 ? empty('今天的習慣都完成了') : <HabitList habits={habitsOpen} today={today} sel={sel} />}
            doneCount={habitsDoneList.length}
            done={<HabitList habits={habitsDoneList} today={today} sel={sel} />}
          />
        )
      case 'courses':
        return todayClasses.length === 0 ? (
          empty('今天沒有課')
        ) : (
          <ul className="space-y-0.5">
            {todayClasses.map((o, i) => {
              const me: Pick = { kind: 'course', id: o.course.id, start: o.session.startTime }
              const active = samePick(current, me)
              return (
              <li key={`${o.course.id}-${i}`}>
                <button
                  type="button"
                  onClick={() => setPicked(me)}
                  aria-pressed={active}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted', active && PICKED_BG)}
                >
                  <span aria-hidden="true" className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: courseColor(o.course) }} />
                  <span className="w-28 shrink-0 text-[13px] font-medium text-muted-foreground tabular-nums">
                    {o.session.startTime}–{o.session.endTime}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{o.course.name}</span>
                  {o.course.location && <span className="shrink-0 text-[13px] text-muted-foreground">{o.course.location}</span>}
                </button>
              </li>
              )
            })}
          </ul>
        )
      case 'overdue':
        return (
          <Split
            open={overdue.length === 0 ? empty('沒有逾期的任務') : <TaskList tasks={overdue} sel={sel} onEdit={openTask} showDate />}
            doneCount={overdueDone.length}
            done={<TaskList tasks={overdueDone} sel={sel} onEdit={openTask} showDate />}
          />
        )
      case 'inbox':
        return (
          <Split
            open={inbox.length === 0 ? empty('沒有未排程的任務') : <TaskList tasks={inbox} sel={sel} onEdit={openTask} />}
            doneCount={inboxDone.length}
            done={<TaskList tasks={inboxDone} sel={sel} onEdit={openTask} />}
          />
        )
    }
  }

  const counts: Record<Panel, number> = {
    tasks: todayOpen.length,
    habits: todayHabits.length - habitsDone,
    courses: todayClasses.length,
    overdue: overdue.length,
    inbox: inbox.length,
  }

  return (
    <div className="flex flex-col px-3 py-3 md:h-full md:px-8 md:py-4">
      <header className="shrink-0 rounded-2xl border bg-card px-5 py-5 text-card-foreground shadow-xs md:px-6 md:pt-6">
        {/* 新增鈕貼齊卡片內距的右上角，和其他頁面的新增鈕同一個位置 */}
        <div className="flex items-center justify-between gap-4 md:items-start">
          <h1 className="min-w-0 text-xl leading-tight font-semibold tracking-tight whitespace-nowrap min-[400px]:text-2xl md:text-3xl">
            <span className="sr-only">今天，</span>
            {formatLong(new Date())}
          </h1>
          <Button onClick={() => openTask(null)} className="shrink-0">
            <PlusIcon />
            新增任務
          </Button>
        </div>
        <FactCushions
          selected={PANEL_TITLES[panel]}
          items={[
            { label: '今日任務', value: `${todayDone.length}/${totalToday}`, onClick: () => selectPanel('tasks') },
            { label: '今日習慣', value: `${habitsDone}/${todayHabits.length}`, onClick: () => selectPanel('habits') },
            { label: '今日課程', value: todayClasses.length, onClick: () => selectPanel('courses') },
            { label: '逾期', value: overdue.length, onClick: () => selectPanel('overdue') },
            { label: '未排程', value: inbox.length, onClick: () => selectPanel('inbox') },
          ]}
        />
      </header>

      {/* 只有這塊在捲動，上面的日期和墊子固定不動。
          跟日曆、習慣頁一樣：左邊清單、右邊欄是點到的那一項的資訊；卡片窄時右邊欄排到下面 */}
      <section
        aria-labelledby="today-panel-title"
        className="@container mt-6 rounded-2xl border bg-card px-5 py-6 text-card-foreground shadow-xs md:px-6 md:min-h-0 md:flex-1 md:overflow-y-auto"
      >
        <div className="flex flex-col gap-6 @min-[900px]:h-full @min-[900px]:flex-row">
          <div className="min-w-0 flex-1 @min-[900px]:overflow-y-auto">
            <h2 id="today-panel-title" className="mb-3 flex items-center gap-2 text-lg font-semibold tracking-tight">
              {PANEL_TITLES[panel]}
              {counts[panel] > 0 && <Badge variant="secondary">{counts[panel]}</Badge>}
            </h2>
            {renderPanel()}
          </div>
          <aside aria-label="資訊" className="@min-[900px]:w-80 @min-[900px]:shrink-0 @min-[900px]:overflow-y-auto">
            {renderDetail()}
          </aside>
        </div>
      </section>

      <TaskDialog open={dialogOpen} onClose={() => setDialogOpen(false)} task={editing} defaults={{ date: today }} />
      <HabitDialog open={editingHabit !== null} onClose={() => setEditingHabit(null)} habit={editingHabit} />
      <CourseDialog open={editingCourse !== null} onClose={() => setEditingCourse(null)} course={editingCourse} />
    </div>
  )
}

type Sel = { current: Pick | null; pick: (p: Pick) => void }
/** 選到、正在右邊欄顯示的那一列的底色（跟任務列的 is-picked 一樣） */
const PICKED_BG = 'bg-[color-mix(in_oklch,var(--foreground)_7%,var(--card))] hover:bg-[color-mix(in_oklch,var(--foreground)_7%,var(--card))]'

/** 點標題是在右邊欄看資訊；滑開的「編輯」才開編輯對話框 */
function TaskList({ tasks, sel, onEdit, showDate }: { tasks: Task[]; sel: Sel; onEdit: (t: Task) => void; showDate?: boolean }) {
  return (
    <ul className="space-y-0.5">
      {tasks.map((t) => (
        <TaskItem
          key={t.id}
          task={t}
          onOpen={() => sel.pick({ kind: 'task', id: t.id })}
          onEdit={onEdit}
          selected={samePick(sel.current, { kind: 'task', id: t.id })}
          showDate={showDate}
        />
      ))}
    </ul>
  )
}

/** 未完成和已完成中間的那條線；已完成那段整段留著顯示，只是每列都被劃掉 */
function Split({ open, done, doneCount }: { open: ReactNode; done: ReactNode; doneCount: number }) {
  return (
    <>
      {open}
      <div className="my-3 flex items-center gap-3 px-3" role="separator" aria-label={`已完成 ${doneCount}`}>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">已完成 {doneCount}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      {doneCount > 0 && done}
    </>
  )
}

function HabitList({ habits, today, sel }: { habits: HabitWithStats[]; today: string; sel: Sel }) {
  return (
    <ul className="space-y-0.5">
      {habits.map((h) => (
        <HabitItem
          key={h.id}
          habit={h}
          today={today}
          selected={samePick(sel.current, { kind: 'habit', id: h.id })}
          onPick={() => sel.pick({ kind: 'habit', id: h.id })}
        />
      ))}
    </ul>
  )
}

/** 跟任務列長得一樣：同一個打勾動畫和刪除線，方框用習慣的顏色。點方框打卡，點名稱在右邊欄看資訊 */
function HabitItem({
  habit,
  today,
  selected,
  onPick,
}: {
  habit: HabitWithStats
  today: string
  selected: boolean
  onPick: () => void
}) {
  const { toggle: save } = useHabitMutations()
  const { shown, toggle, t, held, cut } = useCheckAnimation(habit.logs.includes(today), (done) =>
    save.mutate({ id: habit.id, date: today, done }),
  )
  return (
    <li className={cn('flex h-[52px] items-center gap-3 rounded-xl px-3 transition-colors hover:bg-muted', selected && PICKED_BG)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={shown}
        aria-label={shown ? `取消打卡：${habit.name}` : `打卡：${habit.name}`}
        onClick={toggle}
        className="task-check -m-1.5 grid shrink-0 place-items-center rounded-lg p-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        style={{ '--check': habit.color } as CSSProperties}
      >
        <CheckBox t={t} held={held} />
      </button>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="relative inline-block max-w-full min-w-0 truncate align-top">
          <span style={{ opacity: mix(1, 0.42, held) }}>{habit.name}</span>
          <span className="chk-rule" aria-hidden="true" style={{ transform: `scaleX(${cut.toFixed(4)})` }} />
        </span>
        <span className="ml-auto shrink-0 text-[13px] text-muted-foreground">{frequencyLabel(habit)}</span>
      </button>
    </li>
  )
}
