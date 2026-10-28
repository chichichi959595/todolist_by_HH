import { useState, type FormEvent } from 'react'
import type { TaskCreateInput } from '../../shared/schemas'
import type { Task } from '../../shared/types'
import { PRIORITIES } from '../lib/date'
import { useCategories, useTaskMutations } from '../lib/queries'
import { isOvernight } from '../lib/taskTime'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ChoiceCombobox } from '@/components/ui/choice-combobox'
import { Field, FormActions, Modal } from './Modal'

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
  const [allDay, setAllDay] = useState(initialStart === null)
  const [startTime, setStartTime] = useState(initialStart ?? '09:00')
  const [endTime, setEndTime] = useState(task?.endTime ?? defaults?.endTime ?? '')
  const [priority, setPriority] = useState(task?.priority ?? defaults?.priority ?? 0)
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? defaults?.categoryId ?? null)
  const { data: categories = [] } = useCategories()
  const [done, setDone] = useState(task?.done ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const timed = date !== '' && !allDay
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
      date: date || null,
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

      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label="日期（留空 = 未排程）">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Label className="h-8">
          <Checkbox checked={allDay} disabled={!date} onCheckedChange={(v) => setAllDay(v === true)} />
          全天
        </Label>
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
