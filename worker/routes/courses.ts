import { and, asc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { findCourseConflict } from '../../shared/courses'
import { courseCreateSchema, courseUpdateSchema } from '../../shared/schemas'
import { getDb } from '../db'
import { courses } from '../db/schema'
import type { AppEnv } from '../types'
import { validate } from '../validate'

const idParam = z.object({ id: z.coerce.number().int().positive() })

export const coursesRoute = new Hono<AppEnv>()
  // 課程數量不多，全部一次給
  .get('/', async (c) => {
    const rows = await getDb(c.env).select()
      .from(courses)
      .where(eq(courses.userId, c.var.userId))
      .orderBy(asc(courses.startDate), asc(courses.id))
    return c.json(rows)
  })

  .post('/', validate('json', courseCreateSchema), async (c) => {
    const input = c.req.valid('json')
    const db = getDb(c.env)
    // 只跟自己的課比衝堂
    const conflict = findCourseConflict(input, await db.select().from(courses).where(eq(courses.userId, c.var.userId)))
    if (conflict) return c.json({ error: conflict }, 409)

    const row = await db
      .insert(courses)
      .values({ ...input, userId: c.var.userId })
      .returning()
      .get()
    return c.json(row, 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', courseUpdateSchema), async (c) => {
    const { id } = c.req.valid('param')
    const patch = c.req.valid('json')
    if (Object.keys(patch).length === 0) return c.json({ error: '沒有要更新的欄位' }, 400)

    const db = getDb(c.env)
    const mine = and(eq(courses.id, id), eq(courses.userId, c.var.userId))
    const current = await db.select().from(courses).where(mine).get()
    if (!current) return c.json({ error: '找不到課程' }, 404)
    const next = { ...current, ...patch }
    if (next.startDate > next.endDate) return c.json({ error: '結束日期不能早於開始日期' }, 400)
    const conflict = findCourseConflict(next, await db
        .select()
        .from(courses)
        .where(and(eq(courses.userId, c.var.userId), ne(courses.id, id))),
    )
    if (conflict) return c.json({ error: conflict }, 409)

    const row = await db.update(courses).set(patch).where(mine).returning().get()
    if (!row) return c.json({ error: '找不到課程' }, 404)
    return c.json(row)
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    const row = await getDb(c.env).delete(courses)
      .where(and(eq(courses.id, id), eq(courses.userId, c.var.userId)))
      .returning()
      .get()
    if (!row) return c.json({ error: '找不到課程' }, 404)
    return c.json({ ok: true })
  })
