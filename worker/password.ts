/**
 * 密碼雜湊：PBKDF2-SHA256，每個密碼一個 16 bytes 的隨機鹽。
 * Workers 的 PBKDF2 最多只能跑 100,000 次迭代，所以用滿。
 * 存成 'pbkdf2$<迭代次數>$<鹽 base64>$<雜湊 base64>'，以後要調高次數也認得舊的。
 */
const ITERATIONS = 100_000
const enc = new TextEncoder()

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0))

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

/** 長度一樣才比，而且每個 byte 都比完，不因為早一點不同就提早結束（避免計時攻擊） */
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iter, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false
  const actual = await derive(password, fromB64(salt), Number(iter))
  return sameBytes(actual, fromB64(hash))
}

/** 帳號不存在時也跑一次一樣久的雜湊，讓「沒這個帳號」和「密碼錯」花的時間差不多 */
const DUMMY = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
export const burnPasswordCheck = (password: string) => verifyPassword(password, DUMMY)
