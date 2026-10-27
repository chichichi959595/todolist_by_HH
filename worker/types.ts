/** Hono 的型別：Bindings 是 wrangler 的 Env；登入後 middleware 會放進 userId */
export type AppEnv = {
  Bindings: Env
  Variables: { userId: number }
}
