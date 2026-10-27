import { count, eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { authSchema } from '../../shared/schemas'
import { getDb } from '../db'
import { authAttempts, categories, courses, habits, settings, tasks, users } from '../db/schema'
import { burnPasswordCheck, hashPassword, verifyPassword } from '../password'
import { currentUser, endSession, startSession } from '../session'
import type { AppEnv } from '../types'
import { validate } from '../validate'

// 同一個 email 或同一個 IP，15 分鐘內密碼錯 10 次就先擋住
const MAX_FAILS = 10
const WINDOW_MS = 15 * 60 * 1000

/**
 * 能不能註冊：還沒有任何帳號時一定可以（第一次使用）；
 * 之後要在 wrangler.jsonc 或 Cloudflare 後台把 ALLOW_SIGNUP 設成 "true" 才開放，
 * 不然網址被別人知道，任何人都能來開帳號
 */
async function signupOpen(env: Env) {
  if ((env.ALLOW_SIGNUP as string) === 'true') return true
  const row = await getDb(env).select({ n: count() }).from(users).get()
  return (row?.n ?? 0) === 0
}

async function tooManyFails(env: Env, keys: string[]) {
  const db = getDb(env)
  const now = new Date().toISOString()
  for (const key of keys) {
    const row = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).get()
    if (row && row.resetAt > now && row.count >= MAX_FAILS) return true
  }
  return false
}

async function recordFail(env: Env, keys: string[]) {
  const db = getDb(env)
  const now = new Date()
  const resetAt = new Date(now.getTime() + WINDOW_MS).toISOString()
  for (const key of keys) {
    await db
      .insert(authAttempts)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: authAttempts.key,
        // 上一輪的時間窗過了就從 1 重算
        set: {
          count: sql`CASE WHEN ${authAttempts.resetAt} > ${now.toISOString()} THEN ${authAttempts.count} + 1 ELSE 1 END`,
          resetAt: sql`CASE WHEN ${authAttempts.resetAt} > ${now.toISOString()} THEN ${authAttempts.resetAt} ELSE ${resetAt} END`,
        },
      })
  }
}

export const authRoute = new Hono<AppEnv>()
  // 登入頁用：目前登入的是誰（沒登入回 null），以及能不能註冊
  .get('/me', async (c) => {
    const user = await currentUser(c)
    return c.json({ user, signupOpen: user ? false : await signupOpen(c.env) })
  })

  .post('/register', validate('json', authSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    if (!(await signupOpen(c.env))) return c.json({ error: '目前不開放註冊' }, 403)

    const db = getDb(c.env)
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get()
    if (exists) return c.json({ error: '這個 email 已經註冊過了' }, 409)

    const first = ((await db.select({ n: count() }).from(users).get())?.n ?? 0) === 0
    const user = await db
      .insert(users)
      .values({ email, passwordHash: await hashPassword(password) })
      .returning({ id: users.id, email: users.email })
      .get()

    // 第一個帳號：把加帳號功能之前的資料都歸給它
    if (first) {
      const uid = user.id
      await db.batch([
        db.update(categories).set({ userId: uid }).where(isNull(categories.userId)),
        db.update(tasks).set({ userId: uid }).where(isNull(tasks.userId)),
        db.update(habits).set({ userId: uid }).where(isNull(habits.userId)),
        db.update(courses).set({ userId: uid }).where(isNull(courses.userId)),
        db
          .update(settings)
          .set({ key: sql`${uid} || ':' || ${settings.key}` })
          .where(sql`instr(${settings.key}, ':') = 0`),
      ])
    }

    await startSession(c, user.id)
    return c.json({ user }, 201)
  })

  .post('/login', validate('json', authSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const ip = c.req.header('cf-connecting-ip') ?? 'local'
    const keys = [`email:${email}`, `ip:${ip}`]
    if (await tooManyFails(c.env, keys)) return c.json({ error: '嘗試太多次了，請 15 分鐘後再試' }, 429)

    const db = getDb(c.env)
    const user = await db.select().from(users).where(eq(users.email, email)).get()
    const ok = user ? await verifyPassword(password, user.passwordHash) : await burnPasswordCheck(password)
    if (!user || !ok) {
      await recordFail(c.env, keys)
      // 不說是帳號不存在還是密碼錯
      return c.json({ error: 'email 或密碼不正確' }, 401)
    }

    await db.delete(authAttempts).where(eq(authAttempts.key, `email:${email}`))
    await startSession(c, user.id)
    return c.json({ user: { id: user.id, email: user.email } })
  })

  .post('/logout', async (c) => {
    await endSession(c)
    return c.json({ ok: true })
  })
