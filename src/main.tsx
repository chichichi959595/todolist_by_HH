import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { App } from './App'
import { AuthGate } from './components/AuthGate'
import { AUTH_EXPIRED } from './lib/api'
import { showToast } from './components/Toaster'
import './index.css'

// 登入過期時畫面會直接換成登入頁，不用再跳 toast
const toastError = (err: Error) => {
  if (err.name !== AUTH_EXPIRED) showToast(err.message)
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (err) => toastError(err) }),
  mutationCache: new MutationCache({
    onError: (err, _vars, _ctx, mutation) => {
      if (!mutation.meta?.silent) toastError(err)
    },
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: (count, err) => err.name !== AUTH_EXPIRED && count < 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
