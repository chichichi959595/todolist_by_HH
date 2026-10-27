import { toast } from 'sonner'
export { Toaster } from '@/components/ui/sonner'

/** 給 mutation 失敗等地方用的提示 */
export function showToast(message: string) {
  toast(message)
}
