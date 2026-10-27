import { ChevronRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

/** 今天頁上方的統計卡，只放真實資料；按了切換下面顯示的清單，選中的那張加上 primary 外框 */
export function FactCushions({
  items,
  selected,
}: {
  items: { label: string; value: ReactNode; onClick: () => void }[]
  selected?: string
}) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-3 min-[760px]:grid-cols-5">
      {items.map((item) => {
        const on = selected === item.label
        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            aria-pressed={on}
            className={cn(
              'flex flex-col items-start gap-1.5 rounded-xl border bg-card px-3 py-3.5 text-left text-card-foreground shadow-xs transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50',
              on && 'border-primary ring-1 ring-primary',
            )}
          >
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">{item.value}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 收合區：shadcn Collapsible，箭頭轉向表示開關 */
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Collapsible className="mt-6">
      <CollapsibleTrigger render={<Button variant="ghost" size="sm" className="group -ml-2 text-muted-foreground" />}>
        <ChevronRightIcon className="transition-transform group-data-panel-open:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">{children}</CollapsibleContent>
    </Collapsible>
  )
}
