import { lazy, startTransition, Suspense, useEffect, useRef, useState, type ComponentType, type MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { CategoryDialog } from './components/CategoryDialog'
import { HabitDialog } from './components/HabitDialog'
import { useLogout, useMe } from './components/AuthGate'
import { BookIcon, CalendarIcon, LogOutIcon, PlusIcon, RepeatIcon, SunIcon } from './components/icons'
import { TaskDialog } from './components/TaskDialog'
import { PageTransition } from './components/animate-ui/components/page-transition'
import { EyeTracker } from './components/bencho/EyeTracker'
import { GlideList } from './components/GlideList'
import { Toaster } from './components/Toaster'
import { todayStr } from './lib/date'
import { useCategories } from './lib/queries'
import { storage } from './lib/storage'
import { CategoryView } from './views/CategoryView'
import { HabitsView } from './views/HabitsView'
import { ScheduleView } from './views/ScheduleView'
import { TodayView } from './views/TodayView'

// FullCalendar 比較大，進到日曆頁才載入
const CalendarView = lazy(() => import('./views/CalendarView').then((m) => ({ default: m.CalendarView })))

type View = 'today' | 'calendar' | 'habits' | 'schedule'
type RoutineView = 'habits' | 'schedule'
type Icon = ComponentType<{ className?: string }>

const VIEWS: View[] = ['today', 'calendar', 'habits', 'schedule']

// 「習慣」和「課表」共用側邊欄的一顆按鈕，在那兩頁時再按一次就互相切換
const ROUTINE: Record<RoutineView, { label: string; Icon: Icon; next: RoutineView }> = {
  habits: { label: '習慣', Icon: RepeatIcon, next: 'schedule' },
  schedule: { label: '課表', Icon: BookIcon, next: 'habits' },
}

// 側邊欄的「日曆」會跟著目前的檢視換名字
const CALENDAR_MODE_LABEL: Record<string, string> = {
  dayGridMonth: '月曆',
  timeGridWeek: '週曆',
  timeGridDay: '日曆',
  listWeek: '清單',
}

const CALENDAR_CYCLE: Record<string, string> = {
  timeGridDay: 'timeGridWeek',
  timeGridWeek: 'dayGridMonth',
  dayGridMonth: 'timeGridDay',
}

// 交給 GlideList 那塊滑動的底來表示 hover，按鈕自己的 hover 底色關掉
const GLIDE_ITEM = 'hover:bg-transparent! dark:hover:bg-transparent!'

const readHash = () => window.location.hash.slice(1)

/** 網址 hash 對應的頁面；分類頁是 #category-<id>，未分類是 #category-none（categoryId 為 null） */
function parseHash(hash: string): { view: View | 'category'; categoryId: number | null } {
  const match = /^category-(\d+|none)$/.exec(hash)
  if (match) return { view: 'category', categoryId: match[1] === 'none' ? null : Number(match[1]) }
  return { view: VIEWS.includes(hash as View) ? (hash as View) : 'today', categoryId: null }
}

function useHash() {
  const [hash, setHash] = useState(readHash)
  useEffect(() => {
    // 換頁放在 transition 裡，React 才會用 view transition 播 PageTransition 的換頁動畫
    const onChange = () => startTransition(() => setHash(readHash()))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export function App() {
  const { view, categoryId } = parseHash(useHash())

  // 換頁畫好之後把焦點移到主內容，螢幕閱讀器才知道頁面換了（第一次進來不搶焦點）
  const pageKey = view === 'category' ? `category-${categoryId ?? 'none'}` : view
  const firstPage = useRef(true)
  useEffect(() => {
    if (firstPage.current) {
      firstPage.current = false
      return
    }
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pageKey])
  const { data: categories = [] } = useCategories()
  const uncategorizedActive = view === 'category' && categoryId === null
  const [creating, setCreating] = useState<'task' | 'habit' | 'category' | null>(null)
  const [calendarMode, setCalendarMode] = useState(
    () =>
      storage.get('calendar.view') ??
      (window.matchMedia('(max-width: 640px)').matches ? 'listWeek' : 'dayGridMonth'),
  )

  const [routineMode, setRoutineMode] = useState<RoutineView>(() =>
    storage.get('routine.view') === 'schedule' ? 'schedule' : 'habits',
  )

  // 用網址直接進到習慣或課表時，按鈕也跟著換
  useEffect(() => {
    if (view === 'habits' || view === 'schedule') {
      setRoutineMode(view)
      storage.set('routine.view', view)
    }
  }, [view])

  function changeCalendarMode(mode: string) {
    setCalendarMode(mode)
    storage.set('calendar.view', mode)
  }

  // 已經在該頁時再按一次：日曆循環 日曆 → 週曆 → 月曆 → 日曆（清單檢視按一下回到日曆）；習慣 ↔ 課表
  function handleNavClick(e: MouseEvent, target: View) {
    if (target !== view) return
    if (target === 'calendar') {
      e.preventDefault()
      changeCalendarMode(CALENDAR_CYCLE[calendarMode] ?? 'timeGridDay')
    } else if (target === 'habits' || target === 'schedule') {
      e.preventDefault()
      window.location.hash = ROUTINE[target].next
    }
  }

  const routine = ROUTINE[routineMode]
  const navItems: { view: View; label: string; Icon: Icon; active: boolean; hint?: string }[] = [
    { view: 'today', label: '今天', Icon: SunIcon, active: view === 'today' },
    {
      view: 'calendar',
      label: CALENDAR_MODE_LABEL[calendarMode] ?? '日曆',
      Icon: CalendarIcon,
      active: view === 'calendar',
      hint: '再按一次切換日曆／週曆／月曆',
    },
    {
      view: routineMode,
      label: routine.label,
      Icon: routine.Icon,
      active: view === routineMode,
      hint: '再按一次切換習慣／課表',
    },
  ]

  // 手機下方欄：今天放中間，左邊日曆、右邊習慣／課表
  const [todayItem, calendarItem, routineItem] = navItems
  const mobileNavItems = [calendarItem, todayItem, routineItem]

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="skip-link"
      >
        跳到主內容
      </a>
      <aside
        className="m-4 mr-0 hidden w-60 shrink-0 flex-col gap-1 rounded-2xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:flex"
      >
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          {/* 整個畫面都是牠的範圍，游標在哪就往哪看；點一下會講話 */}
          <span className="brand-mark">
            <EyeTracker size={32} eyeScale={1.3} within="body" />
          </span>
          <span className="font-semibold tracking-tight">
            todolist <span className="text-xs font-normal text-muted-foreground">by HH</span>
          </span>
        </div>
        <div className="mt-3 mb-3 grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setCreating('habit')} aria-label="新增習慣">
            <PlusIcon />
            習慣
          </Button>
          <Button onClick={() => setCreating('task')} aria-label="新增任務">
            <PlusIcon />
            任務
          </Button>
        </div>

        {/* 滑鼠移過去時，一塊淡灰底跟著滑到指到的那一項 */}
        <GlideList className="grid gap-1">
        {navItems.map(({ view: v, label, Icon, active, hint }, i) => (
          <Button
            key={i}
            data-glide
            nativeButton={false}
            render={
              <a
                href={`#${v}`}
                onClick={(e) => handleNavClick(e, v)}
                aria-current={active ? 'page' : undefined}
                title={active ? hint : undefined}
              />
            }
            variant="ghost"
            className={cn(
              'relative h-9 justify-start gap-2.5 px-2.5 font-normal',
              active ? 'nav-active font-semibold text-foreground' : GLIDE_ITEM,
            )}
          >
            <Icon />
            {label}
          </Button>
        ))}
        </GlideList>

        <Separator className="my-3" />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-2.5 pb-1">
            <span className="text-xs font-medium text-muted-foreground">分類</span>
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="ghost" size="icon-sm" onClick={() => setCreating('category')} aria-label="新增分類" />}
              >
                <PlusIcon />
              </TooltipTrigger>
              <TooltipContent side="right">新增分類</TooltipContent>
            </Tooltip>
          </div>
          {/* 分類多的時候在這裡捲動；左右留一點空間給焦點框 */}
          <nav aria-label="分類" className="-mx-1 grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto px-1 py-0.5">
            {categories.length === 0 && <p className="px-2.5 text-sm text-muted-foreground">還沒有分類</p>}
            <GlideList className="grid gap-0.5">
            {categories.map((c) => {
              const active = view === 'category' && categoryId === c.id
              return (
                <Button
                  key={c.id}
                  data-glide
                  nativeButton={false}
                  render={<a href={`#category-${c.id}`} aria-current={active ? 'page' : undefined} />}
                  variant="ghost"
                  className={cn(
                    'relative h-8 w-full justify-start gap-2.5 px-2.5 font-normal',
                    active ? 'nav-active font-semibold text-foreground' : GLIDE_ITEM,
                  )}
                >
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="truncate">{c.name}</span>
                </Button>
              )
            })}
            {/* 沒有分類的任務都在這裡 */}
            <Button
              data-glide
              nativeButton={false}
              render={<a href="#category-none" aria-current={uncategorizedActive ? 'page' : undefined} />}
              variant="ghost"
              className={cn(
                'relative h-8 w-full justify-start gap-2.5 px-2.5 font-normal',
                uncategorizedActive ? 'nav-active font-semibold text-foreground' : GLIDE_ITEM,
              )}
            >
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full border-2 border-muted-foreground/50" />
              <span className="truncate">未分類</span>
            </Button>
            </GlideList>
          </nav>
        </div>

        <AccountBar />
      </aside>

      <main
        id="main"
        tabIndex={-1}
        className={`relative min-w-0 flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] outline-none md:pb-0`}
      >
        {/* 只有右邊的主內容換頁時淡入淡出，側邊欄不動。
            Suspense 包在外面：第一次進月曆還在載程式時，舊頁面留著，載好才直接淡到月曆，不會先閃「載入中」 */}
        <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">載入中…</p>}>
          {/* 手機版不能鎖成 h-full：內容比畫面長時會溢出這層，main 底部留給下方欄的空間就疊在內容上，滑不到最底 */}
          <PageTransition effect="fade" pageKey={pageKey} className="min-h-full md:h-full">
            {view === 'today' && <TodayView />}
            {view === 'category' && <CategoryView key={categoryId ?? 'none'} categoryId={categoryId} />}
            {view === 'calendar' && <CalendarView mode={calendarMode} onModeChange={changeCalendarMode} />}
            {view === 'habits' && <HabitsView />}
            {view === 'schedule' && <ScheduleView />}
          </PageTransition>
        </Suspense>
      </main>

      <nav
        aria-label="主要頁面"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-3 gap-1 rounded-2xl border bg-background p-1 shadow-lg md:hidden"
      >
        {mobileNavItems.map(({ view: v, label, Icon, active }, i) => (
          <Button
            key={i}
            nativeButton={false}
            render={<a href={`#${v}`} onClick={(e) => handleNavClick(e, v)} aria-current={active ? 'page' : undefined} />}
            variant="ghost"
            className={cn('h-14 flex-col gap-0.5 text-xs font-normal', active && 'bg-muted font-medium')}
          >
            <Icon className="size-5" />
            {label}
          </Button>
        ))}
      </nav>

      <TaskDialog open={creating === 'task'} onClose={() => setCreating(null)} defaults={{ date: todayStr() }} />
      <HabitDialog open={creating === 'habit'} onClose={() => setCreating(null)} />
      <CategoryDialog open={creating === 'category'} onClose={() => setCreating(null)} />
      <Toaster />
    </div>
  )
}

/** 側邊欄最下面：目前登入的帳號和登出 */
function AccountBar() {
  const { data } = useMe()
  const logout = useLogout()
  const email = data?.user?.email
  if (!email) return null
  return (
    <div className="mt-2 flex items-center gap-2.5 border-t border-sidebar-border px-1 pt-3">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold text-background uppercase"
      >
        {email[0]}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm" title={email}>
        {email}
      </span>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="登出"
            />
          }
        >
          <LogOutIcon />
        </TooltipTrigger>
        <TooltipContent side="right">登出</TooltipContent>
      </Tooltip>
    </div>
  )
}
