import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  CourseCreateInput,
  CourseUpdateInput,
  HabitCreateInput,
  HabitUpdateInput,
  TaskCreateInput,
  TaskUpdateInput,
  AuthInput,
} from '../../shared/schemas'
import type { Category, Course, Habit, HabitWithStats, Semester, Task } from '../../shared/types'

export type User = { id: number; email: string }
export type Me = { user: User | null; signupOpen: boolean }

/** 登入過期（任何 API 回 401）時發出，AuthGate 收到後把畫面換回登入頁 */
export const AUTH_EXPIRED = 'auth:expired'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new Error('連線失敗，請檢查網路後再試一次')
  }
  if (!res.ok) {
    // 登入、註冊本身的 401 是「密碼錯」，不算登入過期
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(AUTH_EXPIRED))
      throw Object.assign(new Error('登入已過期，請重新登入'), { name: AUTH_EXPIRED })
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `請求失敗（HTTP ${res.status}）`)
  }
  return res.json() as Promise<T>
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const api = {
  me: () => request<Me>('/auth/me'),
  login: (input: AuthInput) => request<{ user: User }>('/auth/login', json('POST', input)),
  register: (input: AuthInput) => request<{ user: User }>('/auth/register', json('POST', input)),
  logout: () => request<{ ok: true }>('/auth/logout', json('POST')),

  tasksInRange: (from: string, to: string) => request<Task[]>(`/tasks?from=${from}&to=${to}`),
  // since：這台裝置今天 00:00，伺服器靠它挑出今天才完成的逾期／未排程任務
  tasksToday: (date: string) =>
    request<Task[]>(`/tasks/today?date=${date}&since=${encodeURIComponent(new Date(`${date}T00:00`).toISOString())}`),
  tasksInCategory: (id: number) => request<Task[]>(`/tasks/category/${id}`),
  createTask: (input: TaskCreateInput) => request<Task>('/tasks', json('POST', input)),
  updateTask: (id: number, patch: TaskUpdateInput) => request<Task>(`/tasks/${id}`, json('PATCH', patch)),
  deleteTask: (id: number) => request<{ ok: true }>(`/tasks/${id}`, json('DELETE')),

  habits: (today: string) => request<HabitWithStats[]>(`/habits?today=${today}`),
  createHabit: (input: HabitCreateInput) => request<Habit>('/habits', json('POST', input)),
  updateHabit: (id: number, patch: HabitUpdateInput) => request<Habit>(`/habits/${id}`, json('PATCH', patch)),
  deleteHabit: (id: number) => request<{ ok: true }>(`/habits/${id}`, json('DELETE')),
  checkHabit: (id: number, date: string) => request<{ ok: true }>(`/habits/${id}/logs/${date}`, json('PUT')),
  uncheckHabit: (id: number, date: string) => request<{ ok: true }>(`/habits/${id}/logs/${date}`, json('DELETE')),

  courses: () => request<Course[]>('/courses'),
  createCourse: (input: CourseCreateInput) => request<Course>('/courses', json('POST', input)),
  updateCourse: (id: number, patch: CourseUpdateInput) => request<Course>(`/courses/${id}`, json('PATCH', patch)),
  deleteCourse: (id: number) => request<{ ok: true }>(`/courses/${id}`, json('DELETE')),

  categories: () => request<Category[]>('/categories'),
  createCategory: (input: CategoryCreateInput) => request<Category>('/categories', json('POST', input)),
  updateCategory: (id: number, patch: CategoryUpdateInput) =>
    request<Category>(`/categories/${id}`, json('PATCH', patch)),
  deleteCategory: (id: number) => request<{ ok: true }>(`/categories/${id}`, json('DELETE')),

  scheduleDays: () => request<{ weekdays: number }>('/settings/schedule-days'),
  setScheduleDays: (weekdays: number) =>
    request<{ weekdays: number }>('/settings/schedule-days', json('PUT', { weekdays })),

  semester: () => request<Semester | null>('/settings/semester'),
  setSemester: (semester: Semester) => request<Semester>('/settings/semester', json('PUT', semester)),
}
