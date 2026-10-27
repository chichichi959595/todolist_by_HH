import { useState, type FormEvent } from 'react'
import type { Category } from '../../shared/types'
import { Trash2Icon } from 'lucide-react'
import { useCategories, useCategoryMutations, useCourses } from '../lib/queries'
import { ColorPicker } from './ColorPicker'
import { HABIT_COLORS } from './HabitDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FormActions, Modal } from './Modal'
import FuseButton from './reactbits/FuseButton'

interface CategoryDialogProps {
  open: boolean
  onClose: () => void
  /** 有傳就是編輯，沒傳就是新增 */
  category?: Category | null
  /** 刪除後要做的事（例如離開分類頁） */
  onDeleted?: () => void
}

export function CategoryDialog({ open, onClose, category, onDeleted }: CategoryDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={category ? '編輯分類' : '新增分類'}>
      <CategoryForm category={category ?? null} onDone={onClose} onDeleted={onDeleted} />
    </Modal>
  )
}

function CategoryForm({
  category,
  onDone,
  onDeleted,
}: {
  category: Category | null
  onDone: () => void
  onDeleted?: () => void
}) {
  const { create, update, remove } = useCategoryMutations()
  const { data: categories = [] } = useCategories()
  const [name, setName] = useState(category?.name ?? '')
  // 新分類預設挑一個還沒人用的顏色
  const [color, setColor] = useState(
    () => category?.color ?? HABIT_COLORS.find((c) => !categories.some((x) => x.color === c)) ?? HABIT_COLORS[0],
  )
  const [courseId, setCourseId] = useState(category?.courseId ?? null)
  const canSubmit = name.trim() !== ''

  // 一門課只能連到一個分類：已經被別的分類連走的課不列出來
  const { data: courses = [] } = useCourses()
  const linkable = courses.filter((course) => !categories.some((c) => c.courseId === course.id && c.id !== category?.id))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    const payload = { name: name.trim(), color, courseId }
    if (category) update.mutate({ id: category.id, patch: payload })
    else create.mutate(payload)
    onDone()
  }

  // 引信燒完才真的刪；燒的期間按「復原」或關掉對話框都不會刪
  function handleDelete() {
    if (!category) return
    remove.mutate(category.id)
    onDone()
    onDeleted?.()
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="分類名稱，例如：學校、工作、生活"
        maxLength={30}
        aria-label="分類名稱"
        className="h-10 text-base"
      />

      <Field label="顏色" group>
        <ColorPicker value={color} onChange={setColor} />
      </Field>

      <Field label="連接課程" group>
        <Select
          value={courseId === null ? 'none' : String(courseId)}
          onValueChange={(v) => v && setCourseId(v === 'none' ? null : Number(v))}
          // Base UI 的 SelectValue 要靠 items 才知道值對應的文字（不然會直接顯示 id）
          items={[{ value: 'none', label: '不連接' }, ...linkable.map((c) => ({ value: String(c.id), label: c.name }))]}
        >
          <SelectTrigger className="w-full" aria-label="連接課程">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">不連接</SelectItem>
            {linkable.map((course) => (
              <SelectItem key={course.id} value={String(course.id)}>
                {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">連接後，課表和日曆上的這門課會用這個分類的顏色</p>
      </Field>

      <FormActions>
        {category && (
          <FuseButton
            label="刪除"
            undoLabel="復原"
            doneLabel="即將刪除分類"
            icon={<Trash2Icon size={14} strokeWidth={1.8} />}
            color="var(--destructive)"
            background="color-mix(in oklch, var(--destructive) 10%, transparent)"
            fuseColor="var(--destructive)"
            size="sm"
            radius={12}
            commitOn="fuseEnd"
            onCommit={handleDelete}
          />
        )}
        <div className="flex-1" />
        <Button type="button" variant="ghost" onClick={onDone}>
          取消
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          儲存
        </Button>
      </FormActions>
    </form>
  )
}
