import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Task } from '../../shared/types'
import { SquarePenIcon, Trash2Icon } from 'lucide-react'
import { formatShort, PRIORITIES } from '../lib/date'
import { useCategories, useTaskMutations } from '../lib/queries'
import { clamp, LAG, mix, RUN, stillness, useSpring } from '../lib/spring'
import { taskTimeLabel } from '../lib/taskTime'
import { NoteIcon } from './icons'
import SwipeRow from './reactbits/SwipeRow'
import { showToast } from './Toaster'

/* 勾選後等動畫走完才真的存：存了之後任務會移到「已完成」，
   太早存就看不到打勾和刪除線。spring 在 tune 50 大約這麼久到位。 */
const COMMIT_MS = 480
const BOX = 20

interface TaskItemProps {
  task: Task
  onOpen: (task: Task) => void
  showDate?: boolean
  /** 在分類頁裡，每個任務都是同一個分類，就不用再標 */
  hideCategory?: boolean
  /** 滑開後「編輯」要做的事；沒給就跟點標題一樣用 onOpen（今天頁點標題是選取，編輯另外開） */
  onEdit?: (task: Task) => void
  /** 正在右邊欄顯示的那一列，底色深一點 */
  selected?: boolean
}

export function TaskItem({ task, onOpen, showDate, hideCategory, onEdit, selected }: TaskItemProps) {
  const { update, remove } = useTaskMutations()
  const { data: categories = [] } = useCategories()
  const category = hideCategory ? undefined : categories.find((c) => c.id === task.categoryId)
  const priority = PRIORITIES[task.priority] ?? PRIORITIES[0]
  const color = priority.color

  const { shown, toggle, t, held, cut } = useCheckAnimation(task.done, (done) =>
    update.mutate({ id: task.id, patch: { done } }),
  )

  return (
    <li>
      {/* 往左滑：滑到底直接刪除，滑一半露出刪除和編輯 */}
      <SwipeRow
        className={selected ? 'task-swipe is-picked' : 'task-swipe'}
        label={task.title}
        actions={[
          { id: 'delete', label: '刪除', icon: <Trash2Icon size={18} strokeWidth={1.75} /> },
          {
            id: 'edit',
            label: '編輯',
            icon: <SquarePenIcon size={18} strokeWidth={1.75} />,
            onSelect: () => (onEdit ?? onOpen)(task),
          },
        ]}
        onCommit={(a) => {
          if (a.id !== 'delete') return
          remove.mutate(task.id)
          showToast(`已刪除「${task.title}」`)
        }}
        actionColor="var(--destructive)"
        onActionColor="#ffffff"
        drawerColor="var(--primary)"
        onDrawerColor="var(--primary-foreground)"
        rowColor="var(--card)"
        textColor="var(--foreground)"
        height={52}
        radius={12}
        actionWidth={72}
      >
      <button
        type="button"
        role="checkbox"
        aria-checked={shown}
        aria-label={shown ? `取消完成：${task.title}` : `完成：${task.title}`}
        onClick={toggle}
        className="task-check -m-1.5 grid shrink-0 place-items-center rounded-lg p-1.5"
        style={{ '--check': color } as CSSProperties}
      >
        <CheckBox t={t} held={held} />
      </button>

      <button type="button" onClick={() => onOpen(task)} className="flex min-w-0 flex-1 items-center gap-4 rounded-lg text-left">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* 刪除線是這個 span 的 scaleX，所以它只跟字一樣寬 */}
          <span className="relative inline-block max-w-full truncate align-top">
            <span style={{ opacity: mix(1, 0.42, held) }}>{task.title}</span>
            <span className="chk-rule" aria-hidden="true" style={{ transform: `scaleX(${cut.toFixed(4)})` }} />
          </span>
          {/* 有備註的話，圖示緊接在標題後面 */}
          {task.notes && (
            <span className="flex shrink-0 items-center text-muted-foreground">
              <NoteIcon className="size-3.5" />
              <span className="sr-only">有備註</span>
            </span>
          )}
          {task.priority > 0 && <span className="sr-only">（重要程度{priority.label}）</span>}
        </div>
        {(showDate || task.startTime || category) && (
          <div className="flex shrink-0 items-center gap-3 text-[13px] text-muted-foreground tabular-nums">
            {category && (
              <span className="flex min-w-0 items-center gap-1">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: category.color }} />
                <span className="truncate">{category.name}</span>
              </span>
            )}
            {task.startTime && (
              <span>{taskTimeLabel(task)}</span>
            )}
            {showDate && task.date && <span>{formatShort(task.date)}</span>}
          </div>
        )}
      </button>
      </SwipeRow>
    </li>
  )
}

/**
 * 打勾動畫：畫面上的勾選先走，等動畫走完才真的存（不然存完那列就換位置，看不到打勾和刪除線）。
 * 伺服器那邊變了（例如別處改的）就照它。任務和今天頁的習慣共用。
 */
export function useCheckAnimation(done: boolean, save: (done: boolean) => void) {
  const [shown, setShown] = useState(done)
  const [synced, setSynced] = useState(done)
  if (synced !== done) {
    setSynced(done)
    setShown(done)
  }
  const pending = useRef<{ timer: number; commit: () => void } | null>(null)
  // 動畫還沒走完就離開頁面的話，直接存，不要把勾選弄丟
  useEffect(() => () => pending.current?.commit(), [])

  function toggle() {
    const next = !shown
    setShown(next)
    if (pending.current) {
      clearTimeout(pending.current.timer)
      pending.current = null
    }
    if (next === done) return
    const commit = () => {
      if (pending.current) clearTimeout(pending.current.timer)
      pending.current = null
      save(next)
    }
    if (stillness()) return commit()
    pending.current = { timer: window.setTimeout(commit, COMMIT_MS), commit }
  }

  /* Checklist 的做法：一個 spring，填色吃原始值（可以略為脹過頭再回來），
     打勾和刪除線吃夾住的值，刪除線晚一點開始 */
  const t = useSpring(shown ? 1 : 0, 50, stillness())
  const held = clamp(t, 0, 1)
  const cut = clamp((held - LAG) / RUN, 0, 1)
  return { shown, toggle, t, held, cut }
}

/** 打勾的方框：填色縮放、勾的筆畫跟著 spring 畫出來；顏色由外層的 --check 決定 */
export function CheckBox({ t, held }: { t: number; held: number }) {
  return (
    <span className="chk-box" style={{ width: BOX, height: BOX, borderRadius: BOX * 0.32 }}>
      <span className="chk-fill" style={{ borderRadius: BOX * 0.32, transform: `scale(${t.toFixed(4)})` }} />
      <svg className="chk-tick" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 12.4 L10.3 16.7 L18 7.6" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - held} />
      </svg>
    </span>
  )
}
