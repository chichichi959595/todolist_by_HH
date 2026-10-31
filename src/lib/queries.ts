import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { computeHabitStats } from '../../shared/habits'
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CourseCreateInput,
  CourseUpdateInput,
  HabitCreateInput,
  HabitUpdateInput,
  TaskUpdateInput,
} from '../../shared/schemas'
import type { HabitWithStats, Semester, Task } from '../../shared/types'
import { api } from './api'
import { todayStr } from './date'

const TASKS = ['tasks'] as const
const HABITS = ['habits'] as const
const COURSES = ['courses'] as const
const SEMESTER = ['settings', 'semester'] as const
const CATEGORIES = ['categories'] as const
const SCHEDULE_DAYS = ['settings', 'scheduleDays'] as const

export function useTodayTasks(date: string) {
  return useQuery({ queryKey: [...TASKS, 'today', date], queryFn: () => api.tasksToday(date) })
}

export function useRangeTasks(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: [...TASKS, 'range', range?.from, range?.to],
    queryFn: () => api.tasksInRange(range!.from, range!.to),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  })
}

/** categoryId 是 null 就是沒有分類的任務 */
export function useCategoryTasks(categoryId: number | null) {
  return useQuery({ queryKey: [...TASKS, 'category', categoryId], queryFn: () => api.tasksInCategory(categoryId) })
}

export function useHabits(today: string) {
  return useQuery({ queryKey: [...HABITS, today], queryFn: () => api.habits(today) })
}

export function useTaskMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: TASKS })

  const create = useMutation({ mutationFn: api.createTask, onSettled: invalidate })

  // 樂觀更新：先改畫面，失敗再還原
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TaskUpdateInput }) => api.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: TASKS })
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: TASKS })
      qc.setQueriesData<Task[]>({ queryKey: TASKS }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: invalidate,
  })

  const remove = useMutation({
    mutationFn: api.deleteTask,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS })
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: TASKS })
      qc.setQueriesData<Task[]>({ queryKey: TASKS }, (old) => old?.filter((t) => t.id !== id))
      return { snapshot }
    },
    onError: (_err, _id, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: invalidate,
  })

  return { create, update, remove }
}

export function useHabitMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: HABITS })

  const create = useMutation({
    mutationFn: (input: HabitCreateInput) => api.createHabit(input),
    onSettled: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: HabitUpdateInput }) => api.updateHabit(id, patch),
    onSettled: invalidate,
  })
  const remove = useMutation({ mutationFn: api.deleteHabit, onSettled: invalidate })

  const toggle = useMutation({
    mutationFn: ({ id, date, done }: { id: number; date: string; done: boolean }) =>
      done ? api.checkHabit(id, date) : api.uncheckHabit(id, date),
    onMutate: async ({ id, date, done }) => {
      await qc.cancelQueries({ queryKey: HABITS })
      const snapshot = qc.getQueriesData<HabitWithStats[]>({ queryKey: HABITS })
      const today = todayStr()
      qc.setQueriesData<HabitWithStats[]>({ queryKey: HABITS }, (old) =>
        old?.map((h) => {
          if (h.id !== id) return h
          const logs = done ? [...new Set([...h.logs, date])].sort() : h.logs.filter((d) => d !== date)
          return { ...h, logs, ...computeHabitStats(h, logs, today) }
        }),
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: invalidate,
  })

  return { create, update, remove, toggle }
}

export function useCourses() {
  return useQuery({ queryKey: COURSES, queryFn: api.courses })
}

export function useCourseMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: COURSES })

  const create = useMutation({ mutationFn: (input: CourseCreateInput) => api.createCourse(input), onSettled: invalidate })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CourseUpdateInput }) => api.updateCourse(id, patch),
    onSettled: invalidate,
  })
  const remove = useMutation({ mutationFn: api.deleteCourse, onSettled: invalidate })

  return { create, update, remove }
}

export function useSemester() {
  return useQuery({ queryKey: SEMESTER, queryFn: api.semester })
}

/** 存學期；後端會順便更新跟著舊學期的課程，所以課程也要重抓 */
export function useSetSemester() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (semester: Semester) => api.setSemester(semester),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: SEMESTER }), qc.invalidateQueries({ queryKey: COURSES })]),
  })
}

export function useCategories() {
  return useQuery({ queryKey: CATEGORIES, queryFn: api.categories })
}

export function useCategoryMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: CATEGORIES })

  const create = useMutation({ mutationFn: (input: CategoryCreateInput) => api.createCategory(input), onSettled: invalidate })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CategoryUpdateInput }) => api.updateCategory(id, patch),
    onSettled: invalidate,
  })
  // 刪掉分類時任務的分類會被清掉，任務也要重抓
  const remove = useMutation({
    mutationFn: api.deleteCategory,
    onSettled: () => Promise.all([invalidate(), qc.invalidateQueries({ queryKey: TASKS })]),
  })

  return { create, update, remove }
}

/** 課表要顯示哪幾天（bitmask，bit 0 = 星期日） */
export function useScheduleDays() {
  return useQuery({ queryKey: SCHEDULE_DAYS, queryFn: api.scheduleDays, select: (d) => d.weekdays })
}

export function useSetScheduleDays() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.setScheduleDays,
    onMutate: (weekdays) => qc.setQueryData(SCHEDULE_DAYS, { weekdays }),
    onSettled: () => qc.invalidateQueries({ queryKey: SCHEDULE_DAYS }),
  })
}
