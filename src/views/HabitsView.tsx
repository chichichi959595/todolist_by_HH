import { useState } from 'react'
import { SquarePenIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Habit, HabitWithStats } from '../../shared/types'
import { HabitDetail } from '../components/DetailCards'
import { frequencyLabel, HabitDialog } from '../components/HabitDialog'
import { PlusIcon } from '../components/icons'
import RubberSegment from '../components/reactbits/RubberSegment'
import SwipeRow from '../components/reactbits/SwipeRow'
import { showToast } from '../components/Toaster'
import { todayStr, WEEKDAY_LABELS, WEEKDAY_ORDER } from '../lib/date'
import { useHabitMutations, useHabits } from '../lib/queries'

/** 每天、或指定星期有勾到這天的習慣 */
const onWeekday = (h: Habit, day: number) =>
  h.frequency === 'daily' || (h.frequency === 'weekdays' && ((h.weekdays >> day) & 1) === 1)

export function HabitsView() {
  const today = todayStr()
  const { data: habits = [], isPending } = useHabits(today)
  const [day, setDay] = useState(() => new Date().getDay())
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [dialog, setDialog] = useState<{ habit: Habit | null } | null>(null)

  const active = habits.filter((h) => !h.archived)
  const dayHabits = active.filter((h) => onWeekday(h, day))
  // 還沒點過、或點的那個不在這天的清單裡，就顯示這天的第一個
  const picked = dayHabits.find((h) => h.id === pickedId) ?? dayHabits[0]
  const openNew = () => setDialog({ habit: null })

  return (
    <div className="flex flex-col px-3 py-3 md:h-full md:px-8 md:py-4">
      <h1 className="sr-only">習慣</h1>
      {/* 跟日曆、課表一樣：左邊這天的習慣表、右邊點到的習慣的資訊。看卡片自己的寬度決定並排或上下排 */}
      <div className="@container flex flex-col rounded-2xl border bg-card p-4 text-card-foreground shadow-xs md:min-h-0 md:flex-1 md:overflow-y-auto md:p-6">
        <div className="flex min-h-0 flex-1 flex-col gap-6 @min-[900px]:flex-row">
          <div className="min-w-0 flex-1 @min-[900px]:overflow-y-auto">
            {isPending ? (
              <p className="px-3 text-muted-foreground">載入中…</p>
            ) : active.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-muted-foreground">還沒有習慣，從一個小目標開始吧</p>
                <Button onClick={openNew} className="mt-5">
                  建立第一個習慣
                </Button>
              </div>
            ) : (
              <HabitSection
                title={`星期${WEEKDAY_LABELS[day]}`}
                habits={dayHabits}
                pickedId={picked?.id ?? null}
                empty="這天沒有排定的習慣"
                onPick={(h) => setPickedId(h.id)}
                onEdit={(h) => setDialog({ habit: h })}
              />
            )}
          </div>

          <section aria-label="習慣資訊" className="@min-[900px]:w-80 @min-[900px]:shrink-0 @min-[900px]:overflow-y-auto">
            {/* 新增鈕和其他頁面一樣在右上角；下面是星期一到日的切換（跟日曆右上角的切換同一個元件） */}
            <div className="mb-3 flex justify-end">
              <Button onClick={openNew}>
                <PlusIcon />
                新增習慣
              </Button>
            </div>
            <RubberSegment
              className="mb-4 w-full"
              items={WEEKDAY_ORDER.map((d) => ({ value: String(d), label: WEEKDAY_LABELS[d] }))}
              value={String(day)}
              onChange={(v) => setDay(Number(v))}
              trackColor="var(--muted)"
              thumbColor="var(--primary)"
              textColor="var(--foreground)"
              activeTextColor="var(--primary-foreground)"
              radius={12}
              aria-label="星期"
            />
            {picked ? (
              <HabitDetail habit={picked} today={today} onEdit={() => setDialog({ habit: picked })} />
            ) : (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                點左邊的習慣，這裡會顯示它的紀錄
              </p>
            )}
          </section>
        </div>
      </div>

      <HabitDialog open={dialog !== null} onClose={() => setDialog(null)} habit={dialog?.habit} />
    </div>
  )
}

function HabitSection({
  title,
  habits,
  empty,
  pickedId,
  onPick,
  onEdit,
}: {
  title: string
  habits: HabitWithStats[]
  empty?: string
  pickedId: number | null
  onPick: (h: Habit) => void
  onEdit: (h: Habit) => void
}) {
  return (
    <section>
      {/* 寬版時標題跟右邊的新增鈕同一行，整塊高度等於「新增鈕＋星期切換」，讓第一條習慣跟右邊卡片上緣對齊 */}
      <div className="mb-3 px-3 @min-[900px]:mb-0 @min-[900px]:h-25">
        <h2 className="flex items-center text-lg font-semibold tracking-tight @min-[900px]:h-9">{title}</h2>
        <p className="text-sm text-muted-foreground">總共 {habits.length} 條習慣</p>
      </div>
      {habits.length === 0 ? (
        <p className="px-3 py-2 text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-0.5">
          {habits.map((h) => (
            <HabitRow key={h.id} habit={h} picked={h.id === pickedId} onPick={() => onPick(h)} onEdit={() => onEdit(h)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function HabitRow({
  habit,
  picked,
  onPick,
  onEdit,
}: {
  habit: HabitWithStats
  picked: boolean
  onPick: () => void
  onEdit: () => void
}) {
  const { remove } = useHabitMutations()
  return (
    <li>
      {/* 往左滑露出刪除和編輯。習慣刪掉會連打卡紀錄一起沒，
          所以關掉「滑到底直接刪」，要按刪除才會刪 */}
      <SwipeRow
        className={cn('task-swipe', picked && 'is-picked')}
        label={habit.name}
        fullSwipe={false}
        actions={[
          { id: 'delete', label: '刪除', icon: <Trash2Icon size={18} strokeWidth={1.75} /> },
          { id: 'edit', label: '編輯', icon: <SquarePenIcon size={18} strokeWidth={1.75} />, onSelect: onEdit },
        ]}
        onCommit={(a) => {
          if (a.id !== 'delete') return
          remove.mutate(habit.id)
          showToast(`已刪除「${habit.name}」`)
        }}
        actionColor="var(--destructive)"
        onActionColor="#ffffff"
        drawerColor="var(--primary)"
        onDrawerColor="var(--primary-foreground)"
        rowColor="var(--card)"
        textColor="var(--foreground)"
        height={58}
        radius={12}
        actionWidth={72}
      >
      {/* 點一下在右邊欄看這個習慣的紀錄；連續、總共等數字也在那邊 */}
      <button
        type="button"
        onClick={onPick}
        aria-pressed={picked}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span aria-hidden="true" className="size-8 shrink-0 rounded-full" style={{ background: habit.color }} />
        <span className="min-w-0 flex-1 truncate font-medium">{habit.name}</span>
        <span className="shrink-0 text-sm text-muted-foreground">{frequencyLabel(habit)}</span>
      </button>
      </SwipeRow>
    </li>
  )
}
