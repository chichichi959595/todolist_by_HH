import { and, asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { computeHabitStats } from '../../shared/habits'
import { dateStr, habitCreateSchema, habitUpdateSchema } from '../../shared/schemas'
import type { HabitWithStats } from '../../shared/types'
import { getDb } from '../db'
import { habitLogs, habits } from '../db/schema'
import type { AppEnv } from '../types'
import { validate } from '../validate'

const idParam = z.object({ id: z.coerce.number().int().positive() })
const logParam = idParam.extend({ date: dateStr })

/** 這個習慣是不是自己的；打卡紀錄沒有 user_id，靠它來確認 */
const ownHabit = (db: ReturnType<typeof getDb>, userId: number, id: number) =>
  db.select({ id: habits.id }).from(habits).where(and(eq(habits.id, id), eq(habits.userId, userId))).get()

export const habitsRoute = new Hono<AppEnv>()
  // 所有習慣（含封存），附上打卡紀錄與連續天數
  .get('/', validate('query', z.object({ today: dateStr })), async (c) => {
    const { today } = c.req.valid('query')
    const db = getDb(c.env)
    const mine = db.select({ id: habits.id }).from(habits).where(eq(habits.userId, c.var.userId))
    const [habitRows, logRows] = await db.batch([
      db.select().from(habits).where(eq(habits.userId, c.var.userId)).orderBy(asc(habits.sortOrder), asc(habits.id)),
      db.select().from(habitLogs).where(inArray(habitLogs.habitId, mine)).orderBy(asc(habitLogs.date)),
    ])

    const logsByHabit = new Map<number, string[]>()
    for (const log of logRows) {
      const list = logsByHabit.get(log.habitId)
      if (list) list.push(log.date)
      else logsByHabit.set(log.habitId, [log.date])
    }

    const result: HabitWithStats[] = habitRows.map((h) => {
      const logs = logsByHabit.get(h.id) ?? []
      return { ...h, logs, ...computeHabitStats(h, logs, today) }
    })
    return c.json(result)
  })

  .post('/', validate('json', habitCreateSchema), async (c) => {
    const row = await getDb(c.env).insert(habits).values({ ...c.req.valid('json'), userId: c.var.userId }).returning().get()
    return c.json(row, 201)
  })

  .patch('/:id', validate('param', idParam), validate('json', habitUpdateSchema), async (c) => {
    const { id } = c.req.valid('param')
    const patch = c.req.valid('json')
    if (Object.keys(patch).length === 0) return c.json({ error: '沒有要更新的欄位' }, 400)

    const row = await getDb(c.env).update(habits)
      .set(patch)
      .where(and(eq(habits.id, id), eq(habits.userId, c.var.userId)))
      .returning()
      .get()
    if (!row) return c.json({ error: '找不到習慣' }, 404)
    return c.json(row)
  })

  .delete('/:id', validate('param', idParam), async (c) => {
    const { id } = c.req.valid('param')
    // habit_logs 透過 ON DELETE CASCADE 一起刪除
    const row = await getDb(c.env).delete(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, c.var.userId)))
      .returning()
      .get()
    if (!row) return c.json({ error: '找不到習慣' }, 404)
    return c.json({ ok: true })
  })

  // 打卡
  .put('/:id/logs/:date', validate('param', logParam), async (c) => {
    const { id, date } = c.req.valid('param')
    const db = getDb(c.env)
    if (!(await ownHabit(db, c.var.userId, id))) return c.json({ error: '找不到習慣' }, 404)

    await db.insert(habitLogs).values({ habitId: id, date }).onConflictDoNothing()
    return c.json({ ok: true })
  })

  // 取消打卡
  .delete('/:id/logs/:date', validate('param', logParam), async (c) => {
    const { id, date } = c.req.valid('param')
    const db = getDb(c.env)
    if (!(await ownHabit(db, c.var.userId, id))) return c.json({ error: '找不到習慣' }, 404)
    await db
      .delete(habitLogs)
      .where(and(eq(habitLogs.habitId, id), eq(habitLogs.date, date)))
    return c.json({ ok: true })
  })
