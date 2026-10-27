import { and, eq, gt } from 'drizzle-orm'
import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { getDb } from './db'
import { sessions, users } from './db/schema'
import type { AppEnv } from './types'

export const COOKIE = 'todolist_session'
const DAY = 24 * 60 * 60 * 1000
// 登入維持 30 天；剩不到一半時，有在用就自動延長
const TTL = 30 * DAY

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))

function writeCookie(c: Context<AppEnv>, token: string, expires: Date) {
  setCookie(c, COOKIE, token, {
    path: '/',
    httpOnly: true,
    // 本機 http://localhost 開發時不能設 Secure，部署後一定是 https
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    expires,
  })
}

/** 登入成功：產生隨機 token 放進 cookie，資料庫只存它的雜湊 */
export async function startSession(c: Context<AppEnv>, userId: number) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const expires = new Date(Date.now() + TTL)
  await getDb(c.env)
    .insert(sessions)
    .values({ id: await sha256(token), userId, expiresAt: expires.toISOString() })
  writeCookie(c, token, expires)
}

export async function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE)
  if (token) await getDb(c.env).delete(sessions).where(eq(sessions.id, await sha256(token)))
  deleteCookie(c, COOKIE, { path: '/' })
}

/** 從 cookie 找出目前登入的帳號；沒登入或過期回 null */
export async function currentUser(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE)
  if (!token) return null
  const id = await sha256(token)
  const db = getDb(c.env)
  const row = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date().toISOString())))
    .get()
  if (!row) return null

  if (new Date(row.expiresAt).getTime() - Date.now() < TTL / 2) {
    const expires = new Date(Date.now() + TTL)
    await db.update(sessions).set({ expiresAt: expires.toISOString() }).where(eq(sessions.id, id))
    writeCookie(c, token, expires)
  }
  return { id: row.userId, email: row.email }
}

/** 其他 API 都要先登入；登入後把 userId 放進 c.var，路由用它只查自己的資料 */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const user = await currentUser(c)
  if (!user) return c.json({ error: '請先登入' }, 401)
  c.set('userId', user.id)
  await next()
})

/**
 * 會改資料的請求，Origin 一定要是自己這個網站。cookie 已經是 SameSite=Lax，
 * 這裡再擋一層，別的網站就算想偷用登入狀態送 POST 也送不進來。
 */
export const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return next()
  const origin = c.req.header('origin')
  if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: '不允許的來源' }, 403)
  await next()
})
