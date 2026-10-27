import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { api, AUTH_EXPIRED, type Me, type User } from '../lib/api'
import { EyeTracker } from './bencho/EyeTracker'

const ME = ['me'] as const

export function useMe() {
  return useQuery({ queryKey: ME, queryFn: api.me, staleTime: Infinity, retry: 1 })
}

/** 登入、登出都把其他帳號的快取整個丟掉，再寫入新的登入狀態 */
function useSwitchUser() {
  const queryClient = useQueryClient()
  return useCallback((user: User | null) => {
    const signupOpen = queryClient.getQueryData<Me>(ME)?.signupOpen ?? false
    // me 留著讓 AuthGate 繼續訂閱；其他都清掉（整個 clear 會讓 useMe 收不到新狀態）
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME[0] })
    queryClient.getMutationCache().clear()
    queryClient.setQueryData<Me>(ME, { user, signupOpen: user ? false : signupOpen })
    // 登出後重新問一次，註冊是否開放可能變了
    if (!user) void queryClient.invalidateQueries({ queryKey: ME })
  }, [queryClient])
}

export function useLogout() {
  const switchUser = useSwitchUser()
  return useMutation({ mutationFn: api.logout, onSettled: () => switchUser(null) })
}

/** 還沒登入就只顯示登入頁；任何 API 回 401 時也會退回這裡 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, isPending, isError, refetch } = useMe()
  const switchUser = useSwitchUser()

  useEffect(() => {
    const expired = () => switchUser(null)
    window.addEventListener(AUTH_EXPIRED, expired)
    return () => window.removeEventListener(AUTH_EXPIRED, expired)
  }, [switchUser])

  if (isPending) return null
  if (isError) {
    return (
      <Centered>
        <p className="text-muted-foreground">連不上伺服器</p>
        <Button variant="outline" onClick={() => refetch()}>
          再試一次
        </Button>
      </Centered>
    )
  }
  if (!data.user) return <LoginScreen signupOpen={data.signupOpen} />
  return children
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-background p-4 text-center">{children}</main>
}

function LoginScreen({ signupOpen }: { signupOpen: boolean }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const switchUser = useSwitchUser()
  const ids = { email: useId(), password: useId(), error: useId() }
  const registering = signupOpen && mode === 'register'

  const submit = useMutation({
    mutationFn: () => (registering ? api.register : api.login)({ email, password }),
    onSuccess: ({ user }) => switchUser(user),
    onError: (err) => setError(err.message),
    // 錯誤直接顯示在表單裡，不再跳 toast
    meta: { silent: true },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    submit.mutate()
  }

  function pick(next: 'login' | 'register') {
    setMode(next)
    setError(null)
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-card-foreground shadow-xs md:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="brand-mark">
            <EyeTracker size={36} eyeScale={1.3} within="body" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">
            todolist <span className="text-xs font-normal text-muted-foreground">by HH</span>
          </h1>
        </div>

        {signupOpen && (
          <div role="tablist" aria-label="登入或註冊" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => pick(m)}
                className={cn(
                  'h-8 rounded-lg text-sm font-medium text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  mode === m && 'bg-card text-foreground shadow-xs',
                )}
              >
                {m === 'login' ? '登入' : '註冊'}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor={ids.email}>Email</Label>
            <Input
              id={ids.email}
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ids.error : undefined}
              className="h-10"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={ids.password}>密碼</Label>
            <Input
              id={ids.password}
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
              required
              minLength={registering ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ids.error : undefined}
              className="h-10"
            />
            {registering && <p className="text-[13px] text-muted-foreground">至少 8 個字</p>}
          </div>
          {error && (
            <p id={ids.error} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submit.isPending} className="mt-1 w-full">
            {submit.isPending ? '請稍候…' : registering ? '建立帳號' : '登入'}
          </Button>
        </form>
      </div>
    </main>
  )
}
