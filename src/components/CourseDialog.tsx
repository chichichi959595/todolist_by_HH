import { addDays } from 'date-fns'
import { useState, type FormEvent } from 'react'
import { COURSE_DAY_END, COURSE_DAY_START, findCourseConflict } from '../../shared/courses'
import type { Course, CourseSession } from '../../shared/types'
import { toDateStr, todayStr, WEEKDAY_LABELS, WEEKDAY_ORDER } from '../lib/date'
import { useCourseMutations, useCourses, useSemester } from '../lib/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChoiceCombobox } from '@/components/ui/choice-combobox'
import { PlusIcon, XIcon } from './icons'
import { Field, FormActions, Modal } from './Modal'

const pad = (n: number) => String(n).padStart(2, '0')
const toChoices = (values: string[]) => values.map((v) => ({ value: v, label: v }))

/** 課表的範圍是 09:10–21:10：時 09–21，分每 5 分鐘一格；組合超出範圍由表單檢查擋下 */
const HOURS = Array.from({ length: 13 }, (_, i) => pad(9 + i))
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5))

const WEEKDAY_CHOICES = WEEKDAY_ORDER.map((d) => ({ value: String(d), label: WEEKDAY_LABELS[d] }))

/** 時跟分分開選；舊資料不在選項裡的值（例如 09:07）也保留在清單最前面 */
function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(':')
  const hours = HOURS.includes(h) ? HOURS : [h, ...HOURS]
  const minutes = MINUTES.includes(m) ? MINUTES : [m, ...MINUTES]
  return (
    <div className="flex items-center gap-1">
      <ChoiceCombobox
        compact
        className="w-14"
        label={`${label}（時）`}
        items={toChoices(hours)}
        value={h}
        onChange={(v) => onChange(`${v}:${m}`)}
        empty="無"
      />
      <span aria-hidden="true" className="text-muted-foreground">
        :
      </span>
      <ChoiceCombobox
        compact
        className="w-14"
        label={`${label}（分）`}
        items={toChoices(minutes)}
        value={m}
        onChange={(v) => onChange(`${h}:${v}`)}
        empty="無"
      />
    </div>
  )
}

/** 沒設定學期時，預設從今天起 18 週 */
const SEMESTER_DAYS = 18 * 7 - 1

interface CourseDialogProps {
  open: boolean
  onClose: () => void
  /** 有傳就是編輯，沒傳就是新增 */
  course?: Course | null
  /** 新增時預填的第一個時段（例如在課表上點的那一格） */
  session?: CourseSession
}

export function CourseDialog({ open, onClose, course, session }: CourseDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={course ? '編輯課程' : '新增課程'}>
      <CourseForm course={course ?? null} session={session} onDone={onClose} />
    </Modal>
  )
}

/** 列在課程清單、彈窗等地方的時段摘要：「一 09:00–11:00、四 13:00–15:00」 */
export const sessionsLabel = (sessions: CourseSession[]) =>
  [...sessions]
    .sort((a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime))
    .map((s) => `${WEEKDAY_LABELS[s.weekday]} ${s.startTime}–${s.endTime}`)
    .join('、')

function CourseForm({
  course,
  session,
  onDone,
}: {
  course: Course | null
  session?: CourseSession
  onDone: () => void
}) {
  const { create, update, remove } = useCourseMutations()
  const today = todayStr()
  const { data: semester } = useSemester()
  const { data: allCourses = [] } = useCourses()
  const [name, setName] = useState(course?.name ?? '')
  const [location, setLocation] = useState(course?.location ?? '')
  // 新課程預設用學期設定的日期；沒設定就從今天起一學期
  const [startDate, setStartDate] = useState(course?.startDate ?? semester?.startDate ?? today)
  const [endDate, setEndDate] = useState(
    course?.endDate ?? semester?.endDate ?? toDateStr(addDays(new Date(), SEMESTER_DAYS)),
  )
  const [sessions, setSessions] = useState<CourseSession[]>(
    course?.sessions ?? [session ?? { weekday: new Date().getDay(), startTime: '09:10', endTime: '10:00' }],
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sessionError = sessions.some((s) => s.startTime >= s.endTime)
    ? '結束時間要晚於開始時間'
    : sessions.some((s) => s.startTime < COURSE_DAY_START || s.endTime > COURSE_DAY_END)
      ? `上課時間要在 ${COURSE_DAY_START}–${COURSE_DAY_END} 之間`
      : null
  const periodError = startDate && endDate && startDate > endDate ? '結束日期不能早於開始日期' : null
  // 同一個時間只能上一堂課（後端也會再檢查一次）
  const conflict =
    sessionError || periodError || !startDate || !endDate
      ? null
      : findCourseConflict(
          { name, sessions, startDate, endDate },
          allCourses.filter((c) => c.id !== course?.id),
        )
  const canSubmit =
    name.trim() !== '' &&
    sessions.length > 0 &&
    startDate !== '' &&
    endDate !== '' &&
    !sessionError &&
    !periodError &&
    !conflict

  function setSession(i: number, patch: Partial<CourseSession>) {
    setSessions(sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  }

  function addSession() {
    const last = sessions.at(-1)
    setSessions([...sessions, last ? { ...last } : { weekday: 1, startTime: '09:10', endTime: '10:00' }])
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const payload = { name: name.trim(), location: location.trim(), sessions, startDate, endDate }
    if (course) update.mutate({ id: course.id, patch: payload })
    else create.mutate(payload)
    onDone()
  }

  function handleDelete() {
    if (!course) return
    if (!confirmDelete) return setConfirmDelete(true)
    remove.mutate(course.id)
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="課程名稱，例如：微積分"
        maxLength={100}
        aria-label="課程名稱"
        className="h-10 text-base"
      />
      <Input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="教室（選填）"
        maxLength={100}
        aria-label="教室"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="開始日期">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </Field>
        <Field label="結束日期">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </Field>
        {periodError && <p className="col-span-2 text-sm text-destructive">{periodError}</p>}
      </div>

      <Field label="上課時間" group>
        <ul className="grid gap-2">
          {sessions.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <ChoiceCombobox
                compact
                className="w-14 shrink-0"
                label="星期"
                items={WEEKDAY_CHOICES}
                value={String(s.weekday)}
                onChange={(v) => setSession(i, { weekday: Number(v) })}
                empty="無"
              />
              <TimeSelect label="開始時間" value={s.startTime} onChange={(startTime) => setSession(i, { startTime })} />
              <span aria-hidden="true" className="text-muted-foreground">
                –
              </span>
              <TimeSelect label="結束時間" value={s.endTime} onChange={(endTime) => setSession(i, { endTime })} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSessions(sessions.filter((_, j) => j !== i))}
                disabled={sessions.length === 1}
                aria-label="移除這個時段"
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={addSession} className="w-fit">
          <PlusIcon />
          新增時段
        </Button>
        {(sessionError || conflict) && (
          <p role="alert" className="text-sm text-destructive">
            {sessionError ?? conflict}
          </p>
        )}
      </Field>

      <FormActions>
        {course && (
          <Button type="button" variant="destructive" onClick={handleDelete}>
            {confirmDelete ? '確定刪除？' : '刪除'}
          </Button>
        )}
        <div className="flex-1" />
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          儲存
        </Button>
      </FormActions>
    </form>
  )
}
