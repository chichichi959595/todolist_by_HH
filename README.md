# 待辦與習慣

個人用的 Todo + 習慣追蹤 + 日曆（月／週／日／清單），部署在 Cloudflare 免費方案。

| 層 | 技術 |
|---|---|
| 前端 | React 19 · Vite · Tailwind CSS v4 · TanStack Query · FullCalendar 6 · date-fns |
| 後端 | Cloudflare Workers · Hono · Zod |
| 資料庫 | Cloudflare D1（SQLite）· Drizzle ORM |
| 登入 | Cloudflare Access（Zero Trust 免費版） |

## 專案結構

```
src/            前端（React）
  views/        今天、日曆、習慣三個頁面
  components/   對話框、任務列等元件
  lib/          API client、React Query hooks
worker/         後端（Hono API，跑在 Workers）
  db/schema.ts  資料表定義 ← 改資料表從這裡改
  routes/       /api/tasks、/api/habits
  auth.ts       Cloudflare Access JWT 驗證
shared/         前後端共用：型別、Zod 驗證、習慣連續天數計算
drizzle/        資料庫 migration（自動產生，不要手改）
```

前端與 API 部署在同一個 Worker：`/api/*` 交給 Hono，其餘路徑回傳前端靜態檔。

## 本機開發

```bash
pnpm install
pnpm db:migrate:local   # 第一次：建立本機資料庫
pnpm dev                # http://localhost:5173
```

本機透過 `.dev.vars` 的 `ALLOW_NO_AUTH=true` 跳過登入驗證（這個檔不會被部署）。

### 修改資料表

1. 編輯 `worker/db/schema.ts`
2. `pnpm db:generate` 產生新的 migration
3. `pnpm db:migrate:local` 套用到本機；部署前再跑 `pnpm db:migrate:remote`

## 部署到 Cloudflare

```bash
# 1. 登入
pnpm exec wrangler login

# 2. 建立 D1 資料庫，把輸出的 database_id 貼到 wrangler.jsonc
pnpm exec wrangler d1 create todolist-db

# 3. 在線上資料庫建立資料表
pnpm db:migrate:remote

# 4. 部署（注意要加 run，`pnpm deploy` 是 pnpm 內建的另一個指令）
pnpm run deploy
```

部署後網址會是 `https://todolist.<你的子網域>.workers.dev`。

### 5. 設定 Cloudflare Access（只讓自己登入）

**在設定好之前，API 會一律回傳 500**（刻意設計成預設拒絕，避免資料外洩）。

1. Cloudflare Dashboard → Workers & Pages → `todolist` → Settings → Domains & Routes
2. 在 `workers.dev` 那一列開啟 **Cloudflare Access**（Preview URLs 也一併開啟或直接停用）
3. 到 Zero Trust → Access → Applications 找到剛建立的 app：
   - Policy 設定成 **Include → Emails → 你的 email**
   - 複製 **Application Audience (AUD) Tag**
4. Zero Trust → Settings → Custom Pages（或 Team domain）找到你的團隊網域，例如 `https://xxx.cloudflareaccess.com`
5. 填到 `wrangler.jsonc` 的 `vars`：
   ```jsonc
   "ACCESS_TEAM_DOMAIN": "https://xxx.cloudflareaccess.com",
   "ACCESS_AUD": "貼上 AUD tag"
   ```
6. 再部署一次：`pnpm run deploy`

之後打開網址會先看到 Cloudflare 的登入頁，輸入 email 收驗證碼即可登入。

### 加到手機主畫面

用手機瀏覽器打開網址 → 分享 → 加入主畫面，就會像 App 一樣全螢幕開啟。

## 免費額度（自己用遠遠用不完）

- Workers：每天 10 萬次請求
- D1：5 GB 儲存、每天 500 萬列讀取 / 10 萬列寫入
- Access：50 位使用者以內免費

（額度以 Cloudflare 官網為準）

## 常用指令

| 指令 | 說明 |
|---|---|
| `pnpm dev` | 本機開發 |
| `pnpm typecheck` | 型別檢查 |
| `pnpm build` | 建置 |
| `pnpm run deploy` | 建置並部署 |
| `pnpm db:generate` | 依 schema 產生 migration |
| `pnpm db:migrate:local` / `:remote` | 套用 migration |
| `pnpm cf-typegen` | 改了 `wrangler.jsonc` 後重新產生 `Env` 型別 |
