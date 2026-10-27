import { motion, useReducedMotion } from 'motion/react'
import { useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const SPRING = { type: 'spring', duration: 0.3, bounce: 0.15 } as const

/**
 * 側邊欄的滑動 hover：整串只有一塊淡灰底，滑鼠往下移時它跟著滑到指到的那一項，
 * 而不是每一項各自亮起來。做法參考 ObsidianUI 的 Dashboard Shell。
 * 裡面的項目要加 data-glide，而且要是 relative（才會疊在這塊底的上面）。
 * 剛移進來時直接出現在那一項，不從上次的位置滑過來；觸控不顯示；減少動態時不滑動。
 */
export function GlideList({ className, children }: { className?: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  const [box, setBox] = useState({ top: 0, height: 0, visible: false, jump: true })

  function handleOver(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-glide]')
    if (!item || !e.currentTarget.contains(item)) return
    const { offsetTop: top, offsetHeight: height } = item
    setBox((b) => (b.visible && b.top === top ? b : { top, height, visible: true, jump: !b.visible }))
  }

  const move = box.jump || reduce ? { duration: 0 } : SPRING
  return (
    <div className={cn('relative', className)} onPointerOver={handleOver} onPointerLeave={() => setBox((b) => ({ ...b, visible: false }))}>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 rounded-md bg-foreground/[0.06]"
        initial={false}
        animate={{ y: box.top, height: box.height, opacity: box.visible ? 1 : 0 }}
        transition={{ y: move, height: move, opacity: { duration: 0.15 } }}
      />
      {children}
    </div>
  )
}
