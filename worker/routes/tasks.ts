import { and, asc, eq, gte, isNull, lt, lte, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { dateStr, taskCreateSchema, taskUpdateSchema } from '../../shared/schemas'
import { getDb } from '../db'
import { categories, tasks } from '../db/schema'
import type { AppEnv } from '../types'
import { validate } from '../validate'

const idParam = z.object({ id: z.coerce.number().int().positive() })

// 分類也要是自己的，不能把任務掛到別人的分類上
const categoryExists = async (db: ReturnType<typeof getDb>, userId: number, id: number) =>
  Boolean(
    await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .get(),
  )
const order = [asc(tasks.date), asc(tasks.startTime), asc(tasks.id)]

// 每個查詢都加上 user_id，只碰得到自己的任務
export const tasksRoute = new Hono<AppEnv>()
  // 日曆用：某段日期內的任務
  .get('/', validate('query', z.object({ from: dateStr, to: dateStr })), async (c) => {
    const { from, to } = c.req.valid('query')
    const rows = await getDb(c.env)
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, c.var.userId), gte(tasks.date, from), lte(tasks.date, to)))
      .orderBy(...order)
    return c.json(rows)
  })

  // 今天頁：今天的任務 + 逾期未完成 + 未排程未完成
  // 今天頁：今天的、逾期沒做完的、沒排日期沒做完的；
  // 有給 since（使用者那邊今天 00:00 的 ISO 時間）的話，逾期和未排程裡今天完成的也一起回，
  // 讓今天頁可以在「已完成」那段顯示
  .get('/today', validate('query', z.object({ date: dateStr, since: z.iso.datetime().optional() })), async (c) => {
    const { date, since } = c.req.valid('query')
    const doneToday = since ? and(eq(tasks.done, true), gte(tasks.completedAt, since)) : undefined
    const rows = await getDb(c.env)
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, c.var.userId),
          or(
            eq(tasks.date, date),
            and(lt(tasks.date, date), eq(tasks.done, false)),
            and(isNull(tasks.date), eq(tasks.done, false)),
            doneToday && and(or(lt(tasks.date, date), isNull(tasks.date)), doneToday),
          ),
        ),
      )
      .orderBy(...order)
    return c.json(rows)
  })

  // 未分類頁：沒有分類的所有任務
  .get('/uncategorized', async (c) => {
    const rows = await getDb(c.env).select().from(tasks).where(and(eq(tasks.userId, c.var.userId), isNull(tasks.categoryId))).orderBy(...order)
    return c.json(rows)
  })

  // 分類頁：這個分類的所有任務
  .get('/category/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    const rows = await getDb(c.env).select().from(tasks).where(and(eq(tasks.userId, c.var.userId), eq(tasks.categoryId, id))).orderBy(...order)
    return c.json(rows)
  })

  .post('/', validate('json', taskCreateSchema), async (c) => {
    const input = c.req.valid('json')
    const db = getDb(c.env)
    if (input.categoryId && !(await categoryExists(db, c.var.userId, input.categoryId)))
      return c.json({ error: '找不到分類' }, 400)
    const row = await db.insert(tasks).values({ ...input, userId: c.var.userId }).returning().get()
    return c.json(row, 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', taskUpdateSchema), async (c) => {
    const { id } = c.req.valid('param')
    const patch = c.req.valid('json')
    if (Object.keys(patch).length === 0) return c.json({ error: '沒有要更新的欄位' }, 400)

    const db = getDb(c.env)
    if (patch.categoryId && !(await categoryExists(db, c.var.userId, patch.categoryId)))
      return c.json({ error: '找不到分類' }, 400)

    const values: Partial<typeof tasks.$inferInsert> = { ...patch }
    if (patch.done !== undefined) values.completedAt = patch.done ? new Date().toISOString() : null

    const row = await db.update(tasks).set(values).where(and(eq(tasks.id, id), eq(tasks.userId, c.var.userId))).returning().get()
    if (!row) return c.json({ error: '找不到任務' }, 404)
    return c.json(row)
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    const row = await getDb(c.env).delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, c.var.userId))).returning().get()
    if (!row) return c.json({ error: '找不到任務' }, 404)
    return c.json({ ok: true })
  })
