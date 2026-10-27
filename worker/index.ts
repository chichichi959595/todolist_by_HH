import { Hono } from 'hono'
import { authRoute } from './routes/auth'
import { categoriesRoute } from './routes/categories'
import { coursesRoute } from './routes/courses'
import { habitsRoute } from './routes/habits'
import { settingsRoute } from './routes/settings'
import { tasksRoute } from './routes/tasks'
import { requireUser, sameOrigin } from './session'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>().basePath('/api')

app.use('*', sameOrigin)
// 登入／註冊／登出不用先登入，其他 API 都要
app.use('*', async (c, next) => (c.req.path.startsWith('/api/auth/') ? next() : requireUser(c, next)))
app.route('/auth', authRoute)
app.route('/tasks', tasksRoute)
app.route('/habits', habitsRoute)
app.route('/courses', coursesRoute)
app.route('/settings', settingsRoute)
app.route('/categories', categoriesRoute)

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: '伺服器錯誤' }, 500)
})

export default app
