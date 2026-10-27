import { useId, type ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * shadcn 的 Dialog（Base UI）；關閉時會卸載內容，下次打開表單會重新初始化。
 * 裡面的下拉選單、Combobox 也是 Base UI，彈出層互相認得，點選單不會誤關對話框
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

/**
 * 表單欄位標題。裡面是一組按鈕時要用 group：
 * 按鈕包在 <label> 裡，按下任一顆，瀏覽器會讓 label 的第一顆按鈕也套上 :active（看起來在閃）
 */
export function Field({ label, group, children }: { label: string; group?: boolean; children: ReactNode }) {
  const id = useId()
  if (group) {
    return (
      <div role="group" aria-labelledby={id} className="grid gap-2">
        <span id={id} className="text-sm leading-none font-medium">
          {label}
        </span>
        {children}
      </div>
    )
  }
  return (
    <Label className="grid gap-2">
      {label}
      {children}
    </Label>
  )
}

/**
 * ToggleGroup 選到的那顆：shadcn 預設只換成很淡的灰底，看不出有沒有按到，
 * 所以表單裡的選項選到時一律變成 primary
 */
export const CHOICE_ON = 'data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/90'

/** 對話框底部：左邊刪除、右邊取消／儲存 */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 pt-2">{children}</div>
}
