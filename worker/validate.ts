import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

/** zValidator 包一層，驗證失敗時回傳 { error: string }，跟其他錯誤格式一致 */
export const validate = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const field = issue?.path.join('.')
      return c.json({ error: `輸入資料有誤${field ? `（${field}）` : ''}：${issue?.message ?? ''}` }, 400)
    }
  })
