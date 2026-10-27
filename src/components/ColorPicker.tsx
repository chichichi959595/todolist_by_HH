import { AvatarGroup, AvatarGroupTooltip, AvatarGroupTooltipArrow } from '@animate-ui/react/primitives/avatar-group'
import { CheckIcon } from './icons'

/** 可以挑的顏色，依色相排一圈；前面八個是原本就有的，舊資料的顏色都在裡面 */
export const PALETTE = [
  { value: '#10b981', name: '翠綠' },
  { value: '#14b8a6', name: '青綠' },
  { value: '#06b6d4', name: '青' },
  { value: '#0ea5e9', name: '天藍' },
  { value: '#3b82f6', name: '藍' },
  { value: '#6366f1', name: '靛藍' },
  { value: '#8b5cf6', name: '紫羅蘭' },
  { value: '#a855f7', name: '紫' },
  { value: '#d946ef', name: '洋紅' },
  { value: '#ec4899', name: '粉紅' },
  { value: '#f43f5e', name: '玫瑰' },
  { value: '#ef4444', name: '紅' },
  { value: '#f97316', name: '橘' },
  { value: '#f59e0b', name: '琥珀' },
  { value: '#84cc16', name: '萊姆' },
  { value: '#64748b', name: '石板灰' },
] as const

/**
 * 顏色選擇：Animate UI 的 AvatarGroup，一排疊在一起的色點，
 * 滑過去那顆會彈起來、上面跟著一個寫顏色名稱的提示；選到的那顆打勾、疊在最上面。
 */
export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <AvatarGroup className="h-10 -space-x-2 pt-1" translate="-25%" sideOffset={14}>
      {PALETTE.map((c) => {
        const selected = c.value === value
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-label={c.name}
            aria-pressed={selected}
            className={`relative grid size-8 place-items-center rounded-full border-3 border-background text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
              selected ? 'z-10 ring-2 ring-foreground' : ''
            }`}
            style={{ background: c.value }}
          >
            {selected && <CheckIcon className="size-3.5" strokeWidth={3} />}
            <AvatarGroupTooltip className="z-[60] rounded-md bg-foreground px-2.5 py-1 text-xs text-background">
              <AvatarGroupTooltipArrow className="size-2.5 fill-foreground" />
              {c.name}
            </AvatarGroupTooltip>
          </button>
        )
      })}
    </AvatarGroup>
  )
}
