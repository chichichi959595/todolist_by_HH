import { useCallback } from 'react'
import type { Course } from '../../shared/types'
import { useCategories } from './queries'

/** 課程沒有自己的顏色：連接到分類就用分類的顏色，否則都用這個 */
export const DEFAULT_COURSE_COLOR = '#64748b'

export function useCourseColor() {
  const { data: categories = [] } = useCategories()
  return useCallback(
    (course: Pick<Course, 'id'>) => categories.find((c) => c.courseId === course.id)?.color ?? DEFAULT_COURSE_COLOR,
    [categories],
  )
}
