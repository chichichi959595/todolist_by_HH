import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { CourseSession } from '../../shared/types'

// 日期一律存 'YYYY-MM-DD'、時間存 'HH:mm'，都是使用者當地時間

// ── 帳號 ─────────────────────────────────────────────
// 密碼只存 PBKDF2 雜湊（格式見 worker/password.ts），email 一律存小寫
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

// 登入狀態：cookie 裡放隨機 token，這裡只存它的 SHA-256，資料庫外洩也拿不到可用的 token
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

// 登入失敗次數，用來擋暴力猜密碼。key 例如 'email:a@b.c'、'ip:1.2.3.4'
export const authAttempts = sqliteTable('auth_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: text('reset_at').notNull(),
})

// 下面每張表的 user_id：資料屬於哪個帳號。
// 加帳號功能之前的舊資料是 null，第一個註冊的帳號會把它們認領走（見 routes/auth.ts）
const owner = () => integer('user_id').references(() => users.id, { onDelete: 'cascade' })

// 任務分類，顯示在側邊欄
export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: owner(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6366f1'),
    // 連接的課程：課表上那門課會用這個分類的顏色。一門課只能連到一個分類
    courseId: integer('course_id').references(() => courses.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [uniqueIndex('categories_course_idx').on(t.courseId), index('categories_user_idx').on(t.userId)],
)

export const tasks = sqliteTable(
  'tasks',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: owner(),
    title: text('title').notNull(),
    notes: text('notes').notNull().default(''),
    // null = 未排程（收件匣）
    date: text('date'),
    // null = 全天
    startTime: text('start_time'),
    endTime: text('end_time'),
    // 0 無、1 低、2 中、3 高
    priority: integer('priority').notNull().default(0),
    // null = 沒有分類；刪掉分類時任務留著、只清掉分類
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    completedAt: text('completed_at'),
    createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => [
    index('tasks_date_idx').on(t.date),
    index('tasks_category_idx').on(t.categoryId),
    index('tasks_user_idx').on(t.userId),
  ],
)

export const habits = sqliteTable('habits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: owner(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#10b981'),
  // daily：每天、weekdays：每週特定幾天、weekly：每週 N 次
  frequency: text('frequency', { enum: ['daily', 'weekdays', 'weekly'] }).notNull().default('daily'),
  // bitmask，bit 0 = 星期日 … bit 6 = 星期六（同 JS Date#getDay）
  weekdays: integer('weekdays').notNull().default(127),
  weeklyTarget: integer('weekly_target').notNull().default(3),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

export const habitLogs = sqliteTable(
  'habit_logs',
  {
    habitId: integer('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.date] }), index('habit_logs_date_idx').on(t.date)],
)

// 課表：每週固定時段上課，只在 startDate–endDate 之間有效
export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: owner(),
  name: text('name').notNull(),
  location: text('location').notNull().default(''),
  color: text('color').notNull().default('#0ea5e9'),
  // [{ weekday, startTime, endTime }]，weekday 同 JS Date#getDay（0 = 星期日）
  sessions: text('sessions', { mode: 'json' }).$type<CourseSession[]>().notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  createdAt: text('created_at').notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

// 零散的設定，value 存 JSON（例如 semester: { startDate, endDate }）。
// 每個帳號一份：key 存成 '<userId>:<名稱>'，例如 '1:semester'（見 routes/settings.ts 的 settingKey）
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
})
