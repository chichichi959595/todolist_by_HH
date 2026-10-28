import { Combobox } from '@animate-ui/react/primitives/base-ui/combobox'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Choice {
  value: string
  label: string
  /** 沒給就不畫顏色點（例如星期、時、分） */
  color?: string
}

/**
 * 帶顏色點的下拉選單（Animate UI 的 Base UI Combobox）：
 * 可以直接打字篩選，也可以點右邊的箭頭打開；一定會有一個選項被選著，不能清空。
 * compact：給星期、時、分這種很短的選項用，寬度由 className 決定，選單可以比輸入框寬一點。
 */
export function ChoiceCombobox({
  items,
  value,
  onChange,
  label,
  empty = '找不到符合的項目',
  compact = false,
  className,
}: {
  items: Choice[]
  value: string
  onChange: (value: string) => void
  label: string
  empty?: string
  compact?: boolean
  className?: string
}) {
  const selected = items.find((i) => i.value === value) ?? null
  const dotted = items.some((i) => i.color)

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(next) => next && onChange(next.value)}
      itemToStringLabel={(i) => i.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <div className={cn('relative', className)}>
        {dotted && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-2.5 -translate-y-1/2 rounded-full"
            style={{ background: selected?.color }}
          />
        )}
        <Combobox.Input
          aria-label={label}
          className={cn(
            'h-10 w-full rounded-xl border border-input bg-transparent text-base tabular-nums transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30',
            compact ? 'pr-7 pl-2.5' : 'pr-10',
            !compact && (dotted ? 'pl-8' : 'pl-3'),
          )}
        />
        <Combobox.Trigger
          aria-label={`打開${label}選單`}
          className={cn(
            'absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
            compact ? 'right-0.5 h-8 w-6' : 'right-1 size-8',
          )}
        >
          <ChevronDownIcon className="size-4" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} className="z-50">
          <Combobox.Popup
            className={cn(
              'max-h-72 origin-(--transform-origin) overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-md outline-none',
              compact ? 'min-w-(--anchor-width)' : 'w-(--anchor-width)',
            )}
          >
            <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground empty:hidden">{empty}</Combobox.Empty>
            <Combobox.List>
              {(item: Choice) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className={cn(
                    'flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm tabular-nums outline-none select-none',
                    'data-highlighted:bg-accent',
                  )}
                >
                  {dotted && (
                    <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <Combobox.ItemIndicator className="text-foreground">
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
