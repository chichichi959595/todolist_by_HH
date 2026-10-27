import { and, asc, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { categoryCreateSchema, categoryUpdateSchema } from '../../shared/schemas'
import { getDb } from '../db'
import { categories, courses } from '../db/schema'
import type { AppEnv } from '../types'
import { validate } from '../validate'

const idParam = z.object({ id: z.coerce.number().int().positive() })

/** 檢查要連接的課程存在、而且沒有被別的分類連走；沒問題回傳 null */
async function checkCourseLink(db: ReturnType<typeof getDb>, userId: number, courseId: number, categoryId?: number) {
  const course = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .get()
  if (!course) return '找不到課程'
  const taken = await db
    .select({ name: categories.name })
    .from(categories)
    .where(categoryId ? and(eq(categories.courseId, courseId), ne(categories.id, categoryId)) : eq(categories.courseId, courseId))
    .get()
  return taken ? `這門課已經連接到「${taken.name}」了` : null
}

export const categoriesRoute = new Hono<AppEnv>()
  .get('/', async (c) => {
    const rows = await getDb(c.env).select()
      .from(categories)
      .where(eq(categories.userId, c.var.userId))
      .orderBy(asc(categories.sortOrder), asc(categories.id))
    return c.json(rows)
  })

  .post('/', validate('json', categoryCreateSchema), async (c) => {
    const input = c.req.valid('json')
    const db = getDb(c.env)
    const linkError = input.courseId ? await checkCourseLink(db, c.var.userId, input.courseId) : null
    if (linkError) return c.json({ error: linkError }, 409)
    const row = await db
      .insert(categories)
      .values({ ...input, userId: c.var.userId })
      .returning()
      .get()
    return c.json(row, 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', categoryUpdateSchema), async (c) => {
    const { id } = c.req.valid('param')
    const patch = c.req.valid('json')
    if (Object.keys(patch).length === 0) return c.json({ error: '沒有要更新的欄位' }, 400)

    const db = getDb(c.env)
    const linkError = patch.courseId ? await checkCourseLink(db, c.var.userId, patch.courseId, id) : null
    if (linkError) return c.json({ error: linkError }, 409)
    const row = await db
      .update(categories)
      .set(patch)
      .where(and(eq(categories.id, id), eq(categories.userId, c.var.userId)))
      .returning()
      .get()
    if (!row) return c.json({ error: '找不到分類' }, 404)
    return c.json(row)
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    // 任務的 category_id 透過 ON DELETE SET NULL 清掉，任務本身保留
    const row = await getDb(c.env).delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, c.var.userId)))
      .returning()
      .get()
    if (!row) return c.json({ error: '找不到分類' }, 404)
    return c.json({ ok: true })
  })
