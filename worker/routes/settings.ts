import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { scheduleDaysSchema, semesterSchema } from '../../shared/schemas'
import type { Semester } from '../../shared/types'
import { getDb } from '../db'
import { courses, settings } from '../db/schema'
import type { AppEnv } from '../types'
import { validate } from '../validate'

/** 設定是每個帳號一份：key 存成 '<userId>:<名稱>' */
const settingKey = (userId: number, name: string) => `${userId}:${name}`

export const settingsRoute = new Hono<AppEnv>()
  // 課表顯示哪幾天，預設全部
  .get('/schedule-days', async (c) => {
    const row = await getDb(c.env).select().from(settings).where(eq(settings.key, settingKey(c.var.userId, 'scheduleDays'))).get()
    return c.json((row?.value as { weekdays: number } | undefined) ?? { weekdays: 127 })
  })

  .put('/schedule-days', validate('json', scheduleDaysSchema), async (c) => {
    const value = c.req.valid('json')
    await getDb(c.env)
      .insert(settings)
      .values({ key: settingKey(c.var.userId, 'scheduleDays'), value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
    return c.json(value)
  })

  // 還沒設定過就回 null
  .get('/semester', async (c) => {
    const row = await getDb(c.env)
      .select()
      .from(settings)
      .where(eq(settings.key, settingKey(c.var.userId, 'semester')))
      .get()
    return c.json((row?.value as Semester | undefined) ?? null)
  })

  // 改學期時，原本日期和舊學期一樣的課程一起換成新的日期
  .put('/semester', validate('json', semesterSchema), async (c) => {
    const next = c.req.valid('json')
    const db = getDb(c.env)
    const key = settingKey(c.var.userId, 'semester')
    const row = await db.select().from(settings).where(eq(settings.key, key)).get()
    const prev = row?.value as Semester | undefined

    const save = db
      .insert(settings)
      .values({ key, value: next })
      .onConflictDoUpdate({ target: settings.key, set: { value: next } })
    if (prev) {
      await db.batch([
        save,
        db
          .update(courses)
          .set(next)
          .where(
            and(
              eq(courses.userId, c.var.userId),
              eq(courses.startDate, prev.startDate),
              eq(courses.endDate, prev.endDate),
            ),
          ),
      ])
    } else {
      await save
    }
    return c.json(next)
  })
