import { useState, type FormEvent } from 'react'
import type { Habit, HabitFrequency } from '../../shared/types'
import { todayStr, WEEKDAY_LABELS, WEEKDAY_ORDER } from '../lib/date'
import { useHabitMutations, useHabits } from '../lib/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PALETTE } from './ColorPicker'
import { CHOICE_ON, Field, FormActions, Modal } from './Modal'

export const HABIT_COLORS: string[] = PALETTE.map((c) => c.value)

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: 'daily', label: '每天' },
  { value: 'weekdays', label: '指定星期' },
]

export function frequencyLabel(h: Pick<Habit, 'frequency' | 'weekdays' | 'weeklyTarget'>) {
  if (h.frequency === 'daily') return '每天'
  if (h.frequency === 'weekly') return `每週 ${h.weeklyTarget} 次`
  if (h.weekdays === 0b0111110) return '平日'
  if (h.weekdays === 0b1000001) return '週末'
  const days = WEEKDAY_ORDER.filter((d) => (h.weekdays >> d) & 1).map((d) => WEEKDAY_LABELS[d])
  return `每週${days.join('、')}`
}

interface HabitDialogProps {
  open: boolean
  onClose: () => void
  habit?: Habit | null
}

export function HabitDialog({ open, onClose, habit }: HabitDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={habit ? '編輯習慣' : '新增習慣'}>
      <HabitForm habit={habit ?? null} onDone={onClose} />
    </Modal>
  )
}

function HabitForm({ habit, onDone }: { habit: Habit | null; onDone: () => void }) {
  const { create, update, remove } = useHabitMutations()
  const [name, setName] = useState(habit?.name ?? '')
  const { data: habits = [] } = useHabits(todayStr())
  // 不讓使用者選顏色：編輯時沿用，新增時挑一個還沒人用的
  const [color] = useState(
    () => habit?.color ?? HABIT_COLORS.find((c) => !habits.some((h) => h.color === c)) ?? HABIT_COLORS[habits.length % HABIT_COLORS.length],
  )
  const [frequency, setFrequency] = useState<HabitFrequency>(habit?.frequency ?? 'daily')
  const [weekdays, setWeekdays] = useState(habit?.weekdays ?? 0b0111110)
  const weeklyTarget = habit?.weeklyTarget ?? 3
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canSubmit = name.trim() !== '' && (frequency !== 'weekdays' || weekdays !== 0)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const payload = { name: name.trim(), color, frequency, weekdays: weekdays || 127, weeklyTarget }
    if (habit) update.mutate({ id: habit.id, patch: payload })
    else create.mutate(payload)
    onDone()
  }

  function handleDelete() {
    if (!habit) return
    if (!confirmDelete) return setConfirmDelete(true)
    remove.mutate(habit.id)
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="例如：喝 2000cc 水、運動 30 分鐘"
        maxLength={100}
        aria-label="名稱"
        className="h-10 text-base"
      />

      <Field label="頻率" group>
        <ToggleGroup
          variant="outline"
          value={[frequency]}
          // 再按一次已選的那顆不要變成「沒選」
          onValueChange={(v) => v[0] && setFrequency(v[0] as HabitFrequency)}
          className="w-full"
        >
          {FREQUENCIES.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className={`flex-1 ${CHOICE_ON}`}>
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {frequency === 'weekdays' && (
        <ToggleGroup
          multiple
          variant="outline"
          aria-label="星期"
          value={WEEKDAY_ORDER.filter((d) => (weekdays >> d) & 1).map(String)}
          onValueChange={(v) => setWeekdays(v.reduce((bits, d) => bits | (1 << Number(d)), 0))}
          className="w-full"
        >
          {WEEKDAY_ORDER.map((d) => (
            <ToggleGroupItem
              key={d}
              value={String(d)}
              aria-label={`星期${WEEKDAY_LABELS[d]}`}
              className={`flex-1 ${CHOICE_ON}`}
            >
              {WEEKDAY_LABELS[d]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <FormActions>
        {habit && (
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
