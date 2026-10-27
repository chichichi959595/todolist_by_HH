import { Combobox } from '@animate-ui/react/primitives/base-ui/combobox'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Choice {
  value: string
  label: string
  color: string
}

/**
 * 帶顏色點的下拉選單（Animate UI 的 Base UI Combobox）：
 * 可以直接打字篩選，也可以點右邊的箭頭打開；一定會有一個選項被選著，不能清空。
 */
export function ChoiceCombobox({
  items,
  value,
  onChange,
  label,
  empty = '找不到符合的項目',
}: {
  items: Choice[]
  value: string
  onChange: (value: string) => void
  label: string
  empty?: string
}) {
  const selected = items.find((i) => i.value === value) ?? null

  return (
    <Combobox.Root
      items={items}
      value={selected}
      onValueChange={(next) => next && onChange(next.value)}
      itemToStringLabel={(i) => i.label}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-2.5 -translate-y-1/2 rounded-full"
          style={{ background: selected?.color }}
        />
        <Combobox.Input
          aria-label={label}
          className="h-10 w-full rounded-xl border border-input bg-transparent pr-10 pl-8 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
        />
        <Combobox.Trigger
          aria-label={`打開${label}選單`}
          className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDownIcon className="size-4" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} className="z-50">
          <Combobox.Popup className="max-h-72 w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Combobox.Empty className="px-2.5 py-2 text-sm text-muted-foreground empty:hidden">{empty}</Combobox.Empty>
            <Combobox.List>
              {(item: Choice) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className={cn(
                    'flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none',
                    'data-highlighted:bg-accent',
                  )}
                >
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
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
