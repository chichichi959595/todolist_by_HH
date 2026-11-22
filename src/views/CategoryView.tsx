import { useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Task } from '../../shared/types'
import { CategoryDialog } from '../components/CategoryDialog'
import { Disclosure } from '../components/blocks'
import { PencilIcon, PlusIcon, SearchIcon, XIcon } from '../components/icons'
import { TaskDialog } from '../components/TaskDialog'
import { TaskItem } from '../components/TaskItem'
import { useCategories, useCategoryTasks } from '../lib/queries'

/** 分類頁：這個分類底下的所有任務；categoryId 是 null 時是「未分類」，列出沒有分類的任務 */
export function CategoryView({ categoryId }: { categoryId: number | null }) {
  const { data: categories, isPending: loadingCategories } = useCategories()
  const { data: tasks = [], isPending } = useCategoryTasks(categoryId)
  const [taskDialog, setTaskDialog] = useState<{ task: Task | null } | null>(null)
  const [editing, setEditing] = useState(false)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchId = useId()
  const searchInput = useRef<HTMLInputElement>(null)
  const searchToggle = useRef<HTMLButtonElement>(null)

  function openSearch() {
    setSearchOpen(true)
    // inert 拿掉之後才能把焦點放進去
    requestAnimationFrame(() => searchInput.current?.focus())
  }
  function closeSearch({ refocus = false } = {}) {
    setSearchOpen(false)
    setQuery('')
    if (refocus) searchToggle.current?.focus()
  }

  const uncategorized = categoryId === null
  const category = categories?.find((c) => c.id === categoryId)
  // 搜尋標題和備註，不分大小寫；空白隔開的每個字都要符合
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const matched = searching
    ? tasks.filter((t) => {
        const text = `${t.title}\n${t.notes}`.toLowerCase()
        return words.every((w) => text.includes(w))
      })
    : tasks
  const open = matched.filter((t) => !t.done)
  const done = matched.filter((t) => t.done)

  if (!uncategorized && !loadingCategories && !category) {
    return <p className="p-8 text-muted-foreground">找不到這個分類，可能已經被刪除了</p>
  }

  return (
    <div className="flex flex-col px-3 py-3 md:h-full md:px-8 md:py-4">
      <div className="rounded-2xl border bg-card px-4 py-6 min-[760px]:px-10 min-[760px]:py-8 text-card-foreground shadow-xs md:min-h-0 md:flex-1 md:overflow-y-auto">
        <div className="mb-6 flex items-center gap-3 px-1">
          {uncategorized ? (
            <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-[3px] border-muted-foreground/50" />
          ) : (
            <span aria-hidden="true" className="size-5 shrink-0 rounded-full" style={{ background: category?.color }} />
          )}
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">
            {uncategorized ? '未分類' : (category?.name ?? '分類')}
          </h1>
          {/* 放大鏡按鈕緊接在標題右邊，按下去往右展開輸入框；有字的時候不會自己收起來 */}
          <Button
            ref={searchToggle}
            variant="ghost"
            size="icon"
            aria-label="搜尋任務"
            title="搜尋任務"
            aria-expanded={searchOpen}
            aria-controls={searchId}
            // 展開時按它是要收起來：別讓輸入框先失去焦點、被 onBlur 收起後又被這次點擊打開
            onMouseDown={(e) => searchOpen && e.preventDefault()}
            onClick={() => (searchOpen ? closeSearch() : openSearch())}
          >
            <SearchIcon />
          </Button>
          <div
            id={searchId}
            inert={!searchOpen}
            onBlur={(e) => {
              if (!query && !e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false)
            }}
            // p-1 留給聚焦外框（overflow-hidden 會切掉）；-my-1 抵掉上下的 p-1，展開後還是 32px 高、比按鈕矮，
            // 這一行不會被撐高、下面的清單不會往下掉。收起時寬度、內距歸零，-ml-3 抵掉 gap，不留空位
            className={`relative -my-1 shrink-0 overflow-hidden transition-[width,padding,margin-left,opacity] duration-(--duration-fast) ease-entrance motion-reduce:transition-none ${
              searchOpen ? '-ml-2 w-42 p-1 opacity-100 min-[760px]:w-58' : '-ml-3 w-0 p-0 opacity-0'
            }`}
          >
            <Input
              ref={searchInput}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  closeSearch({ refocus: true })
                }
              }}
              placeholder={`搜尋${uncategorized ? '未分類' : (category?.name ?? '這個分類')}`}
              aria-label="搜尋任務"
              className="w-40 pr-8 min-[760px]:w-56 [&::-webkit-search-cancel-button]:hidden"
            />
            {searching && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  searchInput.current?.focus()
                }}
                aria-label="清除搜尋"
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>
          {/* 編輯鈕和新增鈕一組靠右，跟標題同一行置中；整組往右推回卡片右邊 24px，新增鈕和其他頁面同一個位置 */}
          <div className="ml-auto flex shrink-0 items-center gap-2 min-[760px]:relative min-[760px]:-right-5">
            {!uncategorized && (
              <Button variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="編輯分類" title="編輯分類">
                <PencilIcon />
              </Button>
            )}
            <Button onClick={() => setTaskDialog({ task: null })}>
              <PlusIcon />
              新增任務
            </Button>
          </div>
        </div>

        <section>
          <h2 className="mb-3 flex items-center gap-2 px-3 text-lg font-semibold tracking-tight">
            未完成
            {open.length > 0 && <Badge variant="secondary">{open.length}</Badge>}
          </h2>
          {isPending ? (
            <p className="px-3 py-2 text-muted-foreground">載入中…</p>
          ) : open.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">
              {searching
                ? done.length > 0
                  ? '符合的任務都完成了'
                  : '找不到符合的任務'
                : done.length > 0
                ? `${uncategorized ? '未分類' : '這個分類'}的任務都完成了`
                : uncategorized
                  ? '沒有未分類的任務'
                  : '這個分類還沒有任務'}
            </p>
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
        defaults={{ categoryId }}
      />
      {!uncategorized && (
        <CategoryDialog
          open={editing}
          onClose={() => setEditing(false)}
          category={category}
          onDeleted={() => (window.location.hash = 'today')}
        />
      )}
    </div>
  )
}
