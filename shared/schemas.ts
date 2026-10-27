import { z } from 'zod'
import { COURSE_DAY_END, COURSE_DAY_START } from './courses'

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式須為 YYYY-MM-DD')
export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '時間格式須為 HH:mm')

const taskFields = {
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(5000),
  date: dateStr.nullable(),
  startTime: timeStr.nullable(),
  endTime: timeStr.nullable(),
  priority: z.number().int().min(0).max(3),
  categoryId: z.number().int().positive().nullable(),
}

// 不在 schema 裡放預設值：沒給的欄位交給資料庫預設，PATCH 時也不會被覆蓋
export const taskCreateSchema = z.object(taskFields).partial().required({ title: true })
export const taskUpdateSchema = z.object({ ...taskFields, done: z.boolean() }).partial()

const habitFields = {
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  frequency: z.enum(['daily', 'weekdays', 'weekly']),
  weekdays: z.number().int().min(1).max(127),
  weeklyTarget: z.number().int().min(1).max(7),
  archived: z.boolean(),
  sortOrder: z.number().int(),
}

export const habitCreateSchema = z.object(habitFields).partial().required({ name: true })
export const habitUpdateSchema = z.object(habitFields).partial()

// 課表一節課從整點十分開始，時段只能排在 09:10–21:10
// 定義搬到 shared/courses（前端也要用，放這裡會把整個 zod 一起打包進前端）
export { COURSE_DAY_END, COURSE_DAY_START } from './courses'

const courseSession = z
  .object({ weekday: z.number().int().min(0).max(6), startTime: timeStr, endTime: timeStr })
  .refine((s) => s.startTime < s.endTime, '結束時間要晚於開始時間')
  .refine((s) => s.startTime >= COURSE_DAY_START && s.endTime <= COURSE_DAY_END, '上課時間要在 09:10–21:10 之間')

const courseFields = {
  name: z.string().trim().min(1).max(100),
  location: z.string().trim().max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sessions: z.array(courseSession).min(1).max(14),
  startDate: dateStr,
  endDate: dateStr,
}

const validPeriod = (c: { startDate?: string; endDate?: string }) =>
  !c.startDate || !c.endDate || c.startDate <= c.endDate

export const courseCreateSchema = z
  .object(courseFields)
  .partial()
  .required({ name: true, sessions: true, startDate: true, endDate: true })
  .refine(validPeriod, '結束日期不能早於開始日期')
export const courseUpdateSchema = z.object(courseFields).partial().refine(validPeriod, '結束日期不能早於開始日期')

const categoryFields = {
  name: z.string().trim().min(1).max(30),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  courseId: z.number().int().positive().nullable(),
  sortOrder: z.number().int(),
}

export const categoryCreateSchema = z.object(categoryFields).partial().required({ name: true })
export const categoryUpdateSchema = z.object(categoryFields).partial()

/** 課表要顯示哪幾天，bitmask：bit 0 = 星期日 … bit 6 = 星期六 */
export const scheduleDaysSchema = z.object({ weekdays: z.number().int().min(1).max(127) })

export const semesterSchema = z
  .object({ startDate: dateStr, endDate: dateStr })
  .refine(validPeriod, '結束日期不能早於開始日期')

export type TaskCreateInput = z.infer<typeof taskCreateSchema>
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>
export type HabitCreateInput = z.infer<typeof habitCreateSchema>
export type HabitUpdateInput = z.infer<typeof habitUpdateSchema>
export type CourseCreateInput = z.infer<typeof courseCreateSchema>
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>

// 登入／註冊：email 存小寫；密碼至少 8 個字，上限 200 避免有人丟超長字串拖慢雜湊
export const authSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('email 格式不正確')).pipe(z.string().max(254)),
  password: z.string().min(8, '密碼至少要 8 個字').max(200, '密碼太長了'),
})
export type AuthInput = z.infer<typeof authSchema>
