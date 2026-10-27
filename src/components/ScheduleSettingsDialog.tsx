import { useState, type FormEvent } from 'react'
import type { Semester } from '../../shared/types'
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '../lib/date'
import { useScheduleDays, useSetScheduleDays, useSetSemester } from '../lib/queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHOICE_ON, Field, FormActions, Modal } from './Modal'

export function ScheduleSettingsDialog({
  open,
  onClose,
  semester,
}: {
  open: boolean
  onClose: () => void
  semester?: Semester | null
}) {
  return (
    <Modal open={open} onClose={onClose} title="課表設定">
      <SettingsForm semester={semester ?? null} onDone={onClose} />
    </Modal>
  )
}

function SettingsForm({ semester, onDone }: { semester: Semester | null; onDone: () => void }) {
  const saveSemester = useSetSemester()
  const saveDays = useSetScheduleDays()
  const { data: currentDays = 127 } = useScheduleDays()
  const [startDate, setStartDate] = useState(semester?.startDate ?? '')
  const [endDate, setEndDate] = useState(semester?.endDate ?? '')
  const [days, setDays] = useState(currentDays)

  // 學期可以不設定；但只填一半、或日期顛倒就不能存
  const periodError =
    (startDate === '') !== (endDate === '')
      ? '學期的開始和結束都要填'
      : startDate && endDate && startDate > endDate
        ? '結束日期不能早於開始日期'
        : null
  const canSubmit = !periodError && days !== 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (startDate && endDate && (startDate !== semester?.startDate || endDate !== semester?.endDate)) {
      saveSemester.mutate({ startDate, endDate })
    }
    if (days !== currentDays) saveDays.mutate(days)
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="學期開始">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="學期結束">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        {periodError ? (
          <p className="text-sm text-destructive">{periodError}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            新增課程時會預設用這段日期。{semester && '原本期間跟學期一樣的課程，也會一起改成新的日期。'}
          </p>
        )}
      </div>

      <Field label="課表顯示哪幾天" group>
        <ToggleGroup
          multiple
          variant="outline"
          value={WEEKDAY_ORDER.filter((d) => (days >> d) & 1).map(String)}
          onValueChange={(v) => setDays(v.reduce((bits, d) => bits | (1 << Number(d)), 0))}
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
        {days === 0 && <p className="text-sm text-destructive">至少要顯示一天</p>}
      </Field>

      <FormActions>
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
