import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Task } from '../../shared/types'
import { CategoryDialog } from '../components/CategoryDialog'
import { Disclosure } from '../components/blocks'
import { PencilIcon, PlusIcon } from '../components/icons'
import { TaskDialog } from '../components/TaskDialog'
import { TaskItem } from '../components/TaskItem'
import { todayStr } from '../lib/date'
import { useCategories, useCategoryTasks } from '../lib/queries'

/** 分類頁：這個分類底下的所有任務 */
export function CategoryView({ categoryId }: { categoryId: number }) {
  const { data: categories, isPending: loadingCategories } = useCategories()
  const { data: tasks = [], isPending } = useCategoryTasks(categoryId)
  const [taskDialog, setTaskDialog] = useState<{ task: Task | null } | null>(null)
  const [editing, setEditing] = useState(false)

  const category = categories?.find((c) => c.id === categoryId)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  if (!loadingCategories && !category) {
    return <p className="p-8 text-muted-foreground">找不到這個分類，可能已經被刪除了</p>
  }

  return (
    <div className="flex flex-col px-3 py-3 md:h-full md:px-8 md:py-4">
      <div className="rounded-2xl border bg-card px-4 py-6 min-[760px]:px-10 min-[760px]:py-8 text-card-foreground shadow-xs md:min-h-0 md:flex-1 md:overflow-y-auto">
        <div className="mb-6 flex items-center gap-3 px-1">
          <span aria-hidden="true" className="size-5 shrink-0 rounded-full" style={{ background: category?.color }} />
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{category?.name ?? '分類'}</h1>
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="編輯分類" title="編輯分類">
            <PencilIcon />
          </Button>
          {/* 和習慣頁一樣，往右上推回和其他頁面一樣的位置 */}
          <Button onClick={() => setTaskDialog({ task: null })} className="ml-auto shrink-0 min-[760px]:relative min-[760px]:-top-2 min-[760px]:-right-5">
            <PlusIcon />
            新增任務
          </Button>
        </div>

        <section>
          <h2 className="mb-3 flex items-center gap-2 px-3 text-lg font-semibold tracking-tight">
            未完成
            {open.length > 0 && <Badge variant="secondary">{open.length}</Badge>}
          </h2>
          {isPending ? (
            <p className="px-3 py-2 text-muted-foreground">載入中…</p>
          ) : open.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">{done.length > 0 ? '這個分類的任務都完成了' : '這個分類還沒有任務'}</p>
          ) : (
            <ul className="space-y-0.5">
              {open.map((t) => (
                <TaskItem key={t.id} task={t} onOpen={(task) => setTaskDialog({ task })} showDate hideCategory />
              ))}
            </ul>
          )}
        </section>

        {done.length > 0 && (
          <Disclosure title={`已完成 ${done.length}`}>
            <ul className="space-y-0.5">
              {done.map((t) => (
                <TaskItem key={t.id} task={t} onOpen={(task) => setTaskDialog({ task })} showDate hideCategory />
              ))}
            </ul>
          </Disclosure>
        )}
      </div>

      <TaskDialog
        open={taskDialog !== null}
        onClose={() => setTaskDialog(null)}
        task={taskDialog?.task}
        defaults={{ date: todayStr(), categoryId }}
      />
      <CategoryDialog
        open={editing}
        onClose={() => setEditing(false)}
        category={category}
        onDeleted={() => (window.location.hash = 'today')}
      />
    </div>
  )
}
