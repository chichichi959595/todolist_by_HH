import { useState, type FormEvent } from 'react'
import type { TaskCreateInput } from '../../shared/schemas'
import type { Task } from '../../shared/types'
import { PRIORITIES, todayStr } from '../lib/date'
import { useCategories, useTaskMutations } from '../lib/queries'
import { isOvernight } from '../lib/taskTime'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceCombobox } from '@/components/ui/choice-combobox'
import { Field, FormActions, Modal } from './Modal'
import RubberSegment from './reactbits/RubberSegment'

interface TaskDialogProps {
  open: boolean
  onClose: () => void
  /** 有傳就是編輯，沒傳就是新增 */
  task?: Task | null
  defaults?: Partial<TaskCreateInput>
}

export function TaskDialog({ open, onClose, task, defaults }: TaskDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={task ? '編輯任務' : '新增任務'}>
      <TaskForm task={task ?? null} defaults={defaults} onDone={onClose} />
    </Modal>
  )
}

function TaskForm({
  task,
  defaults,
  onDone,
}: {
  task: Task | null
  defaults?: Partial<TaskCreateInput>
  onDone: () => void
}) {
  const { create, update, remove } = useTaskMutations()
  const initialStart = task?.startTime ?? defaults?.startTime ?? null

  const [title, setTitle] = useState(task?.title ?? defaults?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [date, setDate] = useState(task?.date ?? defaults?.date ?? '')
  // 留空 = 沒有期限；跟全天互斥，勾掉時保留原本選的日期
  const [noDate, setNoDate] = useState(date === '')
  const [allDay, setAllDay] = useState(initialStart === null && date !== '')
  const [startTime, setStartTime] = useState(initialStart ?? '09:00')
  const [endTime, setEndTime] = useState(task?.endTime ?? defaults?.endTime ?? '')
  const [priority, setPriority] = useState(task?.priority ?? defaults?.priority ?? 0)
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? defaults?.categoryId ?? null)
  const { data: categories = [] } = useCategories()
  const [done, setDone] = useState(task?.done ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const timed = !noDate && !allDay

  function pickNoDate(v: boolean) {
    setNoDate(v)
    if (v) setAllDay(false)
    else if (!date) setDate(todayStr())
  }

  function pickAllDay(v: boolean) {
    setAllDay(v)
    if (v) pickNoDate(false)
  }

  function pickMode(mode: string) {
    if (mode === 'none') pickNoDate(true)
    else if (mode === 'allDay') pickAllDay(true)
    else if (noDate) pickNoDate(false)
    else setAllDay(false)
  }

  function changeDate(value: string) {
    setDate(value)
    if (!value) pickNoDate(true)
  }

  // 結束早於開始就是隔天結束（跨夜）；只有一樣的時間不行
  const timeError = timed && endTime !== '' && endTime === startTime ? '結束時間不能跟開始時間一樣' : null
  const overnight = timed && !timeError && isOvernight({ startTime, endTime: endTime || null })
  const canSubmit = title.trim() !== '' && !timeError

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const payload = {
      title: title.trim(),
      notes,
      date: noDate ? null : date,
      startTime: timed ? startTime : null,
      endTime: timed && endTime ? endTime : null,
      priority,
      categoryId,
    }
    if (task) update.mutate({ id: task.id, patch: { ...payload, done } })
    else create.mutate(payload)
    onDone()
  }

  function handleDelete() {
    if (!task) return
    if (!confirmDelete) return setConfirmDelete(true)
    remove.mutate(task.id)
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="要做什麼？"
        maxLength={200}
        aria-label="標題"
        className="h-10 text-base"
      />

      {/* 和下面重要程度／分類同一個兩欄格線：日期對齊重要程度，留空／全天撐滿分類那一欄 */}
      <div className="grid grid-cols-2 items-end gap-3">
        {/* min-w-0：iPad 的日期框天生比較寬，不讓它撐破欄寬 */}
        <div className="min-w-0">
          <Field label="日期">
            <Input
              type="date"
              value={noDate ? '' : date}
              disabled={noDate}
              onChange={(e) => changeDate(e.target.value)}
              className="h-10 rounded-xl"
            />
          </Field>
        </div>
        {/* 跟重要程度一樣的框，中間一條線；兩格互斥，再點一次已選的那格就取消，回到指定時間 */}
        <div className="rounded-xl dark:bg-input/30">
          <RubberSegment
            className="rubber-segment--divided w-full border border-input"
            items={[
              { value: 'none', label: '留空' },
              { value: 'allDay', label: '全天' },
            ]}
            value={noDate ? 'none' : allDay ? 'allDay' : ''}
            onChange={pickMode}
            deselectable
            draggable={false}
            size="field"
            // 跟下拉選單的 rounded-xl 一樣：--radius 1rem × 1.4
            radius={22.4}
            trackColor="transparent"
            thumbColor="var(--primary)"
            textColor="var(--foreground)"
            activeTextColor="var(--primary-foreground)"
            aria-label="期限"
          />
        </div>
      </div>

      {timed && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="開始">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </Field>
          <Field label={overnight ? '結束（隔天）' : '結束（選填）'}>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-invalid={timeError ? true : undefined}
            />
          </Field>
          {timeError && <p className="col-span-2 text-sm text-destructive">{timeError}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="重要程度" group>
          <ChoiceCombobox
            label="重要程度"
            items={PRIORITIES.map((p) => ({ value: String(p.value), label: p.label, color: p.color }))}
            value={String(priority)}
            onChange={(v) => setPriority(Number(v))}
          />
        </Field>
        <Field label="分類" group>
          <ChoiceCombobox
            label="分類"
            items={[
              { value: 'none', label: '無', color: 'var(--muted-foreground)' },
              ...categories.map((c) => ({ value: String(c.id), label: c.name, color: c.color })),
            ]}
            value={categoryId === null ? 'none' : String(categoryId)}
            onChange={(v) => setCategoryId(v === 'none' ? null : Number(v))}
            empty="找不到這個分類"
          />
        </Field>
      </div>

      <Field label="備註">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={5000} />
      </Field>

      {task && (
        <Label>
          <Checkbox checked={done} onCheckedChange={(v) => setDone(v === true)} />
          已完成
        </Label>
      )}

      <FormActions>
        {task && (
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

