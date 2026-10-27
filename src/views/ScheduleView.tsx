import { addDays, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useState, type MouseEvent } from 'react'
import { courseOccurrences, isCourseActive, type CourseOccurrence } from '../../shared/courses'
import { weekStart } from '../../shared/habits'
import type { Course, CourseSession } from '../../shared/types'
import { CourseDialog, sessionsLabel } from '../components/CourseDialog'
import { PlusIcon, SlidersIcon } from '../components/icons'
import { ScheduleSettingsDialog } from '../components/ScheduleSettingsDialog'
import { toDateStr, todayStr, WEEKDAY_LABELS } from '../lib/date'
import { useCourseColor } from '../lib/courses'
import { useCourses, useScheduleDays, useSemester } from '../lib/queries'

// 課表顯示 09:10–21:10
const START_HOUR = 9
const END_HOUR = 21
const HOURS = END_HOUR - START_HOUR
// 每一格從整點十分開始：09:10、10:10 … 20:10
const OFFSET = 10
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const toPercent = (t: string) =>
  Math.min(100, Math.max(0, ((toMinutes(t) - START_HOUR * 60 - OFFSET) / (HOURS * 60)) * 100))
const pad = (n: number) => String(n).padStart(2, '0')

const shortDate = (d: string) => format(new Date(`${d}T00:00`), 'yyyy/M/d')

/** 同一天裡時間重疊的課分欄：每段連續重疊的課一組，組內依序放進第一個空出來的欄 */
function layoutDay(list: CourseOccurrence[]) {
  const result: { o: CourseOccurrence; col: number; cols: number }[] = []
  let group: typeof result = []
  let columnEnds: string[] = []
  let groupEnd = ''
  const flush = () => {
    for (const item of group) item.cols = columnEnds.length
    group = []
    columnEnds = []
  }
  for (const o of list) {
    if (group.length > 0 && o.session.startTime >= groupEnd) flush()
    let col = columnEnds.findIndex((end) => end <= o.session.startTime)
    if (col === -1) col = columnEnds.push(o.session.endTime) - 1
    else columnEnds[col] = o.session.endTime
    groupEnd = group.length === 0 || o.session.endTime > groupEnd ? o.session.endTime : groupEnd
    const item = { o, col, cols: 1 }
    group.push(item)
    result.push(item)
  }
  flush()
  return result
}

export function ScheduleView() {
  const today = todayStr()
  const { data: courses = [], isPending } = useCourses()
  const { data: semester } = useSemester()
  const { data: visibleDays = 127 } = useScheduleDays()
  const courseColor = useCourseColor()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dialog, setDialog] = useState<{ course: Course | null; session?: CourseSession } | null>(null)

  // 顯示本週；課程只在有效期間內出現
  const start = weekStart(new Date())
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const from = toDateStr(week[0])
  const to = toDateStr(week[6])
  // 課表設定裡可以關掉某幾天（例如六日）
  const days = week.filter((d) => ((visibleDays >> d.getDay()) & 1) === 1)
  const gridColumns = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` }
  const occurrences = courseOccurrences(courses, from, to)

  // 已結束的課程排在最後
  const sorted = [...courses].sort(
    (a, b) => Number(today > a.endDate) - Number(today > b.endDate) || a.startDate.localeCompare(b.startDate),
  )

  // 點空白處：用那一格的星期和整點開新課程
  function handleColumnClick(e: MouseEvent<HTMLDivElement>, date: Date) {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const hour = Math.min(END_HOUR - 1, START_HOUR + Math.floor(((e.clientY - rect.top) / rect.height) * HOURS))
    setDialog({
      course: null,
      session: { weekday: date.getDay(), startTime: `${pad(hour)}:${pad(OFFSET)}`, endTime: `${pad(hour + 1)}:00` },
    })
  }

  return (
    <div className="flex flex-col px-3 py-3 md:h-full md:px-8 md:py-4">
      <h1 className="sr-only">課表</h1>
      {/* 版面看卡片自己的寬度（container query），不看整個視窗：
          瀏覽器開了側邊欄、視窗變窄時，只要卡片放得下就維持左右並排；
          放不下才把課程清單排到課表下面，這時整張卡片可以捲動 */}
      <div className="@container rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col px-4 py-5 md:min-h-0 md:flex-1 md:overflow-y-auto md:px-6 md:py-6">
        <div className="flex min-h-0 flex-1 flex-col gap-6 @min-[640px]:flex-row">
          {/* 週課表 */}
          <div className="flex min-h-[720px] flex-1 flex-col overflow-hidden rounded-xl border @min-[640px]:min-h-0">
            <div className="grid border-b border-border" style={gridColumns}>
              <div />
              {days.map((d) => {
                const key = toDateStr(d)
                return (
                  <div
                    key={key}
                    className={`border-l border-border py-2 text-center text-[13px] font-medium ${key === today ? 'bg-muted' : ''}`}
                  >
                    {WEEKDAY_LABELS[d.getDay()]}
                    <span className="ml-1 font-medium text-muted-foreground tabular-nums">{format(d, 'M/d')}</span>
                  </div>
                )
              })}
            </div>

            <div className="relative grid min-h-0 flex-1" style={gridColumns}>
              {/* 時間軸 */}
              <div className="relative" aria-hidden="true">
                {Array.from({ length: HOURS }, (_, i) => (
                  <span
                    key={i}
                    className="absolute right-2 text-xs text-muted-foreground tabular-nums"
                    style={{ top: `calc(${(i / HOURS) * 100}% + 4px)` }}
                  >
                    {pad(START_HOUR + i)}:{pad(OFFSET)}
                  </span>
                ))}
              </div>

              {days.map((d) => {
                const key = toDateStr(d)
                return (
                  <div
                    key={key}
                    onClick={(e) => handleColumnClick(e, d)}
                    className={`relative cursor-pointer border-l border-border ${key === today ? 'bg-muted/50' : ''}`}
                    style={{
                      backgroundImage: 'linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
                      backgroundSize: `100% calc(100% / ${HOURS})`,
                    }}
                  >
                    {layoutDay(occurrences.filter((o) => o.date === key)).map(({ o, col, cols }, i) => {
                        const top = toPercent(o.session.startTime)
                        const height = toPercent(o.session.endTime) - top
                        return (
                          <button
                            key={`${o.course.id}-${i}`}
                            type="button"
                            onClick={() => setDialog({ course: o.course })}
                            title={`${o.course.name} ${o.session.startTime}–${o.session.endTime}${o.course.location ? ` ${o.course.location}` : ''}`}
                            className="absolute flex flex-col overflow-hidden rounded-lg px-1.5 py-1 text-left text-white"
                            style={{
                              top: `calc(${top}% + 1px)`,
                              height: `calc(${height}% - 2px)`,
                              // 時間重疊的課左右並排
                              left: `calc(${(col / cols) * 100}% + 2px)`,
                              width: `calc(${100 / cols}% - 4px)`,
                              background: courseColor(o.course),
                            }}
                          >
                            <span className="truncate text-[13px] leading-tight font-medium">{o.course.name}</span>
                            <span className="overflow-hidden text-[11px] leading-tight tracking-tight whitespace-nowrap opacity-90 tabular-nums">
                              {o.session.startTime}–{o.session.endTime}
                            </span>
                            {o.course.location && (
                              <span className="truncate text-[11px] leading-tight opacity-90">{o.course.location}</span>
                            )}
                          </button>
                        )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 課程清單 */}
          <section className="@min-[640px]:w-60 @min-[640px]:shrink-0 @min-[640px]:overflow-y-auto">
            {/* 左邊是「課程」標題，右上角是課表設定和新增課程（跟其他頁面一樣大、一樣位置） */}
            <div className="mb-4 flex items-center gap-2">
              <h2 className="flex min-w-0 flex-1 items-baseline gap-2 px-1 text-lg font-medium tracking-tight">
                課程
                {courses.length > 0 && <span className="text-[13px] font-medium text-muted-foreground">{courses.length}</span>}
              </h2>
              <Tooltip>
                <TooltipTrigger
                  render={<Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)} aria-label="課表設定" />}
                >
                  <SlidersIcon />
                </TooltipTrigger>
                <TooltipContent>課表設定</TooltipContent>
              </Tooltip>
              <Button onClick={() => setDialog({ course: null })}>
                <PlusIcon />
                新增課程
              </Button>
            </div>
            {/* 有設定學期才顯示期間；沒設定就不放提示 */}
            {semester && (
              <p className="mb-3 px-1 text-[13px] text-muted-foreground tabular-nums">
                學期 {shortDate(semester.startDate)} – {shortDate(semester.endDate)}
              </p>
            )}
            {isPending ? (
              <p className="px-1 text-muted-foreground">載入中…</p>
            ) : courses.length === 0 ? (
              <p className="px-1 text-muted-foreground">還沒有課程，按「新增課程」或直接點課表上的空格</p>
            ) : (
              <ul className="space-y-1">
                {sorted.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setDialog({ course: c })}
                      className={`flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left ${
                        isCourseActive(c, today) ? '' : 'opacity-60'
                      }`}
                    >
                      <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: courseColor(c) }} />
                      {/* 只放時段和教室；學期、狀態在編輯對話框裡看 */}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        {/* 一個時段一行，不讓時間從中間斷開 */}
                        {sessionsLabel(c.sessions)
                          .split('、')
                          .map((label) => (
                            <span key={label} className="block text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">
                              {label}
                            </span>
                          ))}
                        {c.location && <span className="block text-[13px] text-muted-foreground">{c.location}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ScheduleSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} semester={semester} />
      <CourseDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        course={dialog?.course}
        session={dialog?.session}
      />
    </div>
  )
}
