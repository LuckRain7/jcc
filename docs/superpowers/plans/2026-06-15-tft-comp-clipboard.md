# 金铲铲阵容码收藏工具 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一个个人用、跨设备同步的网页工具，用密码保护，能在电脑和手机浏览器上增删改查「金铲铲」阵容，并一键把阵容码复制到剪贴板。

**Architecture:** Next.js（App Router）单体应用部署到 Vercel。浏览器不直连数据库，所有数据访问经过 Next.js 的 Route Handlers 中转，Supabase service role key 仅存在于服务端。单用户用一个密码门：登录成功下发签名的 httpOnly cookie，API 层用 HMAC 验签。middleware 仅做 cookie 存在性检查负责把未登录用户跳转到登录页（UX 用途），真正的安全边界是 API 层验签。

**Tech Stack:** Next.js 15（App Router）、TypeScript、Tailwind CSS v4、Supabase（Postgres）、Vitest + React Testing Library、Node `crypto`（HMAC 会话签名）。

---

## 文件结构

```
package.json
next.config.ts
tsconfig.json
postcss.config.mjs
vitest.config.ts
vitest.setup.ts
.env.local.example
.gitignore
README.md
supabase/
  schema.sql                       # 建表 SQL（在 Supabase SQL Editor 执行）
src/
  middleware.ts                    # cookie 存在性检查 → 未登录跳转 /login
  lib/
    auth.ts                        # HMAC 签名/验签 cookie 值（纯函数）
    validate.ts                    # 阵容输入校验（纯函数）
    supabase.ts                    # service role client 单例
    compositions.ts                # 数据访问层（CRUD）
    guard.ts                       # 服务端读 cookie 做 HMAC 验签
  app/
    globals.css                    # Tailwind 入口 + 基础样式
    layout.tsx                     # 根布局
    login/page.tsx                 # 登录页（client）
    page.tsx                       # 主页：渲染 <CompositionsApp/>
    api/
      login/route.ts               # POST 校验密码 → 下发 cookie
      logout/route.ts              # POST 清除 cookie
      compositions/route.ts        # GET 列表 / POST 新增
      compositions/[id]/route.ts   # PUT 编辑 / DELETE 删除
  components/
    CompositionsApp.tsx            # client，状态管理 + 调 API
    CompositionCard.tsx            # 单张阵容卡片
    CompositionForm.tsx            # 新增/编辑表单
    CopyButton.tsx                 # 复制按钮（含降级）
```

测试文件与被测文件同目录，命名 `*.test.ts(x)`。

---

## Task 1: 项目脚手架与工具链

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `.env.local.example`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: 初始化 npm 项目并安装依赖**

Run:
```bash
npm init -y
npm install next@15 react@19 react-dom@19 @supabase/supabase-js
npm install -D typescript @types/node @types/react @types/react-dom \
  tailwindcss @tailwindcss/postcss \
  vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: 写 `package.json` 的 scripts**

把 `package.json` 的 `"scripts"` 替换为：
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: 写 `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: 写 `postcss.config.mjs`（Tailwind v4）**

```js
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
```

- [ ] **Step 6: 写 `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 7: 写 `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 8: 写 `.gitignore`**

```
node_modules
.next
.env.local
*.tsbuildinfo
next-env.d.ts
coverage
```

- [ ] **Step 9: 写 `.env.local.example`**

```
# 访问密码（登录页输入的密码）
APP_PASSWORD=改成你的密码
# 给会话 cookie 签名用的随机长字符串（如 openssl rand -hex 32 生成）
SESSION_SECRET=替换成随机64位十六进制
# Supabase 项目设置 → API 里获取
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

- [ ] **Step 10: 写 `src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  color-scheme: light dark;
}

body {
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 11: 写 `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "金铲铲阵容码",
  description: "收藏并一键复制金铲铲阵容码",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 12: 写占位 `src/app/page.tsx`（后续 Task 14 替换）**

```tsx
export default function Home() {
  return <main className="p-6">脚手架就绪</main>;
}
```

- [ ] **Step 13: 验证开发服务器能启动**

Run: `npm run dev`
Expected: 终端输出 `Ready`，浏览器打开 `http://localhost:3000` 显示「脚手架就绪」。确认后 Ctrl+C 停止。

- [ ] **Step 14: 验证测试能运行**

Run: `npm run test`
Expected: Vitest 输出 `No test files found`（此时还没有测试），退出码非报错即可。

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: 初始化 Next.js + Tailwind + Vitest 脚手架"
```

---

## Task 2: 认证签名工具 auth.ts（TDD）

会话 cookie 的值是对固定字符串做 HMAC-SHA256 的结果。单用户场景无需存 payload，验签即「重算并常数时间比对」。

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth.test.ts`

- [ ] **Step 1: 写失败的测试 `src/lib/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { COOKIE_NAME, makeAuthCookieValue, isValidAuthCookie } from "./auth";

describe("auth cookie", () => {
  const secret = "test-secret-123";

  it("COOKIE_NAME 是稳定的字符串", () => {
    expect(COOKIE_NAME).toBe("tft_auth");
  });

  it("makeAuthCookieValue 对同一 secret 是确定性的", () => {
    expect(makeAuthCookieValue(secret)).toBe(makeAuthCookieValue(secret));
  });

  it("用正确的值验签通过", () => {
    const value = makeAuthCookieValue(secret);
    expect(isValidAuthCookie(value, secret)).toBe(true);
  });

  it("用错误的值验签失败", () => {
    expect(isValidAuthCookie("deadbeef", secret)).toBe(false);
  });

  it("用不同 secret 验签失败", () => {
    const value = makeAuthCookieValue(secret);
    expect(isValidAuthCookie(value, "other-secret")).toBe(false);
  });

  it("undefined / 空值验签失败", () => {
    expect(isValidAuthCookie(undefined, secret)).toBe(false);
    expect(isValidAuthCookie("", secret)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL，提示无法从 `./auth` 导入（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/auth.ts`**

```ts
import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "tft_auth";
const PAYLOAD = "tft-comp-auth";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update(PAYLOAD).digest("hex");
}

export function makeAuthCookieValue(secret: string): string {
  return expectedToken(secret);
}

export function isValidAuthCookie(
  value: string | undefined,
  secret: string,
): boolean {
  if (!value) return false;
  const expected = expectedToken(secret);
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS，6 个用例全绿。

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: 会话 cookie 的 HMAC 签名与验签"
```

---

## Task 3: 输入校验 validate.ts（TDD）

**Files:**
- Create: `src/lib/validate.ts`, `src/lib/validate.test.ts`

- [ ] **Step 1: 写失败的测试 `src/lib/validate.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { validateCompositionInput } from "./validate";

describe("validateCompositionInput", () => {
  it("name 与 code 都有时通过，并 trim", () => {
    const r = validateCompositionInput({ name: "  炮台  ", code: " ABC ", note: " 说明 " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ name: "炮台", code: "ABC", note: "说明" });
    }
  });

  it("note 缺省时为 null", () => {
    const r = validateCompositionInput({ name: "a", code: "b" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.note).toBeNull();
  });

  it("空 note 归一化为 null", () => {
    const r = validateCompositionInput({ name: "a", code: "b", note: "   " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.note).toBeNull();
  });

  it("缺 name 时失败", () => {
    const r = validateCompositionInput({ code: "b" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/name/);
  });

  it("缺 code 时失败", () => {
    const r = validateCompositionInput({ name: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/code/);
  });

  it("body 非对象时失败", () => {
    expect(validateCompositionInput(null).ok).toBe(false);
    expect(validateCompositionInput("x").ok).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/validate.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/validate.ts`**

```ts
export interface CompositionInput {
  name: string;
  code: string;
  note: string | null;
}

export type ValidateResult =
  | { ok: true; value: CompositionInput }
  | { ok: false; error: string };

export function validateCompositionInput(body: unknown): ValidateResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid body" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const code = typeof b.code === "string" ? b.code.trim() : "";
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (!name) return { ok: false, error: "name is required" };
  if (!code) return { ok: false, error: "code is required" };
  return { ok: true, value: { name, code, note: note || null } };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/validate.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts src/lib/validate.test.ts
git commit -m "feat: 阵容输入校验纯函数"
```

---

## Task 4: Supabase client 与数据库 schema

**Files:**
- Create: `supabase/schema.sql`, `src/lib/supabase.ts`

- [ ] **Step 1: 写 `supabase/schema.sql`**

```sql
create extension if not exists "pgcrypto";

create table if not exists compositions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists compositions_updated_at_idx
  on compositions (updated_at desc);
```

- [ ] **Step 2: 在 Supabase 执行 schema（手动一次性步骤）**

在 Supabase 控制台 → SQL Editor 粘贴 `supabase/schema.sql` 全部内容并 Run。
Expected: 提示 `Success. No rows returned`，Table Editor 里出现 `compositions` 表。

- [ ] **Step 3: 实现 `src/lib/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql src/lib/supabase.ts
git commit -m "feat: Supabase schema 与 service role client"
```

---

## Task 5: 数据访问层 compositions.ts

数据层很薄，只把校验过的输入透传给 Supabase。每个函数接受 `SupabaseClient` 参数，便于在测试中传入 fake。

**Files:**
- Create: `src/lib/compositions.ts`, `src/lib/compositions.test.ts`

- [ ] **Step 1: 写失败的测试 `src/lib/compositions.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listCompositions, createComposition } from "./compositions";

function fakeDb(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ order, single }));
  const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
  const from = vi.fn(() => ({ select, insert }));
  return { db: { from } as unknown as SupabaseClient, from, select, order, insert };
}

describe("compositions data layer", () => {
  it("listCompositions 按 updated_at 倒序查 compositions 表", async () => {
    const rows = [{ id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t" }];
    const f = fakeDb({ data: rows, error: null });
    const result = await listCompositions(f.db);
    expect(f.from).toHaveBeenCalledWith("compositions");
    expect(f.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  it("listCompositions 在出错时抛异常", async () => {
    const f = fakeDb({ data: null, error: new Error("boom") });
    await expect(listCompositions(f.db)).rejects.toThrow("boom");
  });

  it("createComposition 插入并返回新行", async () => {
    const row = { id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t" };
    const f = fakeDb({ data: row, error: null });
    const result = await createComposition(f.db, { name: "a", code: "c", note: null });
    expect(f.insert).toHaveBeenCalledWith({ name: "a", code: "c", note: null });
    expect(result).toEqual(row);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/compositions.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/lib/compositions.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompositionInput } from "./validate";

export interface Composition {
  id: string;
  name: string;
  note: string | null;
  code: string;
  created_at: string;
  updated_at: string;
}

const TABLE = "compositions";

export async function listCompositions(db: SupabaseClient): Promise<Composition[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Composition[];
}

export async function createComposition(
  db: SupabaseClient,
  input: CompositionInput,
): Promise<Composition> {
  const { data, error } = await db
    .from(TABLE)
    .insert({ name: input.name, code: input.code, note: input.note })
    .select()
    .single();
  if (error) throw error;
  return data as Composition;
}

export async function updateComposition(
  db: SupabaseClient,
  id: string,
  input: CompositionInput,
): Promise<Composition> {
  const { data, error } = await db
    .from(TABLE)
    .update({
      name: input.name,
      code: input.code,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Composition;
}

export async function deleteComposition(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/compositions.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/compositions.ts src/lib/compositions.test.ts
git commit -m "feat: 阵容数据访问层 CRUD"
```

---

## Task 6: 鉴权守卫 guard.ts

服务端从请求 cookie 里读会话值并做 HMAC 验签，供 API 路由复用。

**Files:**
- Create: `src/lib/guard.ts`

- [ ] **Step 1: 实现 `src/lib/guard.ts`**

```ts
import { cookies } from "next/headers";
import { COOKIE_NAME, isValidAuthCookie } from "./auth";

export async function isAuthed(): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return isValidAuthCookie(value, secret);
}
```

- [ ] **Step 2: 类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无错误输出（退出码 0）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/guard.ts
git commit -m "feat: 服务端 cookie 验签守卫"
```

---

## Task 7: 登录 / 登出 API

**Files:**
- Create: `src/app/api/login/route.ts`, `src/app/api/logout/route.ts`

- [ ] **Step 1: 实现 `src/app/api/login/route.ts`**

```ts
import { NextResponse } from "next/server";
import { COOKIE_NAME, makeAuthCookieValue } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = body?.password;
  const secret = process.env.SESSION_SECRET;
  if (!secret || !process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "服务未配置密码" }, { status: 500 });
  }
  if (typeof password !== "string" || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, makeAuthCookieValue(secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
```

- [ ] **Step 2: 实现 `src/app/api/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 3: 类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/login/route.ts src/app/api/logout/route.ts
git commit -m "feat: 登录/登出 API"
```

---

## Task 8: compositions 集合 API（GET / POST）

**Files:**
- Create: `src/app/api/compositions/route.ts`, `src/app/api/compositions/route.test.ts`

- [ ] **Step 1: 写失败的测试 `src/app/api/compositions/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/guard", () => ({ isAuthed: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: vi.fn(() => ({})) }));
vi.mock("@/lib/compositions", () => ({
  listCompositions: vi.fn(),
  createComposition: vi.fn(),
}));

import { isAuthed } from "@/lib/guard";
import { listCompositions, createComposition } from "@/lib/compositions";
import { GET, POST } from "./route";

const authed = vi.mocked(isAuthed);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/compositions", () => {
  it("未登录返回 401", async () => {
    authed.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("已登录返回列表", async () => {
    authed.mockResolvedValue(true);
    vi.mocked(listCompositions).mockResolvedValue([
      { id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
  });
});

describe("POST /api/compositions", () => {
  it("未登录返回 401", async () => {
    authed.mockResolvedValue(false);
    const req = new Request("http://x/api/compositions", { method: "POST", body: "{}" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("参数非法返回 400", async () => {
    authed.mockResolvedValue(true);
    const req = new Request("http://x/api/compositions", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("合法参数创建并返回 201", async () => {
    authed.mockResolvedValue(true);
    vi.mocked(createComposition).mockResolvedValue({
      id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t",
    });
    const req = new Request("http://x/api/compositions", {
      method: "POST",
      body: JSON.stringify({ name: "a", code: "c" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.item.id).toBe("1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/api/compositions/route.test.ts`
Expected: FAIL（`./route` 不存在）。

- [ ] **Step 3: 实现 `src/app/api/compositions/route.ts`**

```ts
import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/guard";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listCompositions, createComposition } from "@/lib/compositions";
import { validateCompositionInput } from "@/lib/validate";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const items = await listCompositions(getSupabaseAdmin());
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const result = validateCompositionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const item = await createComposition(getSupabaseAdmin(), result.value);
  return NextResponse.json({ item }, { status: 201 });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/app/api/compositions/route.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/app/api/compositions/route.ts src/app/api/compositions/route.test.ts
git commit -m "feat: compositions 集合 API（GET/POST）"
```

---

## Task 9: compositions 单条 API（PUT / DELETE）

**Files:**
- Create: `src/app/api/compositions/[id]/route.ts`, `src/app/api/compositions/[id]/route.test.ts`

- [ ] **Step 1: 写失败的测试 `src/app/api/compositions/[id]/route.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/guard", () => ({ isAuthed: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: vi.fn(() => ({})) }));
vi.mock("@/lib/compositions", () => ({
  updateComposition: vi.fn(),
  deleteComposition: vi.fn(),
}));

import { isAuthed } from "@/lib/guard";
import { updateComposition, deleteComposition } from "@/lib/compositions";
import { PUT, DELETE } from "./route";

const authed = vi.mocked(isAuthed);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("PUT /api/compositions/[id]", () => {
  it("未登录返回 401", async () => {
    authed.mockResolvedValue(false);
    const req = new Request("http://x", { method: "PUT", body: "{}" });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(401);
  });

  it("参数非法返回 400", async () => {
    authed.mockResolvedValue(true);
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(400);
  });

  it("合法参数更新并返回 200", async () => {
    authed.mockResolvedValue(true);
    vi.mocked(updateComposition).mockResolvedValue({
      id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t",
    });
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "a", code: "c" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(200);
    expect(updateComposition).toHaveBeenCalledWith(expect.anything(), "1", {
      name: "a", code: "c", note: null,
    });
  });
});

describe("DELETE /api/compositions/[id]", () => {
  it("未登录返回 401", async () => {
    authed.mockResolvedValue(false);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(401);
  });

  it("已登录删除并返回 200", async () => {
    authed.mockResolvedValue(true);
    vi.mocked(deleteComposition).mockResolvedValue(undefined);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(deleteComposition).toHaveBeenCalledWith(expect.anything(), "1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run "src/app/api/compositions/[id]/route.test.ts"`
Expected: FAIL（`./route` 不存在）。

- [ ] **Step 3: 实现 `src/app/api/compositions/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/guard";
import { getSupabaseAdmin } from "@/lib/supabase";
import { updateComposition, deleteComposition } from "@/lib/compositions";
import { validateCompositionInput } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const result = validateCompositionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const item = await updateComposition(getSupabaseAdmin(), id, result.value);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  await deleteComposition(getSupabaseAdmin(), id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run "src/app/api/compositions/[id]/route.test.ts"`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/compositions/[id]/route.ts" "src/app/api/compositions/[id]/route.test.ts"
git commit -m "feat: compositions 单条 API（PUT/DELETE）"
```

---

## Task 10: middleware 页面保护

middleware 跑在 Edge runtime（无 `node:crypto`），因此只做 cookie **存在性**检查负责跳转；真正的 HMAC 验签在 API 层。安全边界是 API，不是 middleware。

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 实现 `src/middleware.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  if (value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // 放行登录页、所有 API、Next 静态资源
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: 类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无错误。

注意：`auth.ts` 用到 `node:crypto`，但 middleware 只 import `COOKIE_NAME` 常量。Next 的 tree-shaking 不会把 `createHmac` 打进 Edge bundle。若构建时报 Edge 不支持 crypto，把 `COOKIE_NAME` 抽到独立的 `src/lib/cookie-name.ts` 常量文件，让 middleware 与 auth 都从它 import。

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware 未登录跳转登录页"
```

---

## Task 11: 登录页 UI

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: 实现 `src/app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/");
      } else {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "登录失败");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
        <h1 className="text-center text-xl font-semibold">金铲铲阵容码</h1>
        <input
          type="password"
          inputMode="text"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="访问密码"
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-neutral-900 py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: 手动验证**

Run: `npm run dev`，浏览器访问 `http://localhost:3000`（先在 `.env.local` 填好 `APP_PASSWORD`、`SESSION_SECRET`、`SUPABASE_*`）。
Expected: 未登录被 middleware 跳到 `/login`；输错密码显示「密码错误」；输对密码跳转回首页（此时首页还是占位/列表，取决于进度）。验证后 Ctrl+C。

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: 登录页"
```

---

## Task 12: CopyButton 组件（TDD）

复制成功显示「已复制 ✓」；剪贴板不可用或失败时切到降级 UI（展示可长按选中的文本框）。

**Files:**
- Create: `src/components/CopyButton.tsx`, `src/components/CopyButton.test.tsx`

- [ ] **Step 1: 写失败的测试 `src/components/CopyButton.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyButton } from "./CopyButton";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CopyButton", () => {
  it("点击成功复制后显示已复制", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const user = userEvent.setup();
    render(<CopyButton code="ABC123" />);
    await user.click(screen.getByRole("button", { name: /复制/ }));
    expect(writeText).toHaveBeenCalledWith("ABC123");
    expect(await screen.findByText(/已复制/)).toBeInTheDocument();
  });

  it("剪贴板失败时显示降级文本框", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });
    const user = userEvent.setup();
    render(<CopyButton code="ABC123" />);
    await user.click(screen.getByRole("button", { name: /复制/ }));
    const fallback = await screen.findByDisplayValue("ABC123");
    expect(fallback).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/CopyButton.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/components/CopyButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export function CopyButton({ code }: { code: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(code);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("fallback");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCopy}
        className="w-full rounded-lg bg-emerald-600 py-3 text-base font-medium text-white active:bg-emerald-700"
      >
        {status === "copied" ? "已复制 ✓" : "复制阵容码"}
      </button>
      {status === "fallback" && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500">无法自动复制，请长按下方选中复制：</p>
          <input
            readOnly
            value={code}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/CopyButton.test.tsx`
Expected: PASS（2 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/components/CopyButton.tsx src/components/CopyButton.test.tsx
git commit -m "feat: 复制按钮组件（含降级）"
```

---

## Task 13: 阵容卡片与表单组件

**Files:**
- Create: `src/components/CompositionCard.tsx`, `src/components/CompositionForm.tsx`, `src/components/CompositionCard.test.tsx`

- [ ] **Step 1: 写失败的测试 `src/components/CompositionCard.test.tsx`**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompositionCard } from "./CompositionCard";

const item = {
  id: "1", name: "娑娜炮台", note: "三星娑娜核心", code: "TFTSET",
  created_at: "t", updated_at: "t",
};

describe("CompositionCard", () => {
  it("渲染名称与备注", () => {
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("娑娜炮台")).toBeInTheDocument();
    expect(screen.getByText("三星娑娜核心")).toBeInTheDocument();
  });

  it("点编辑触发 onEdit", async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<CompositionCard item={item} onEdit={onEdit} onDelete={() => {}} />);
    await user.click(screen.getByRole("button", { name: "编辑" }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it("点删除并确认后触发 onDelete", async () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<CompositionCard item={item} onEdit={() => {}} onDelete={onDelete} />);
    await user.click(screen.getByRole("button", { name: "删除" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/CompositionCard.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/components/CompositionCard.tsx`**

```tsx
"use client";

import type { Composition } from "@/lib/compositions";
import { CopyButton } from "./CopyButton";

export function CompositionCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Composition;
  onEdit: (item: Composition) => void;
  onDelete: (id: string) => void;
}) {
  function handleDelete() {
    if (window.confirm(`删除「${item.name}」？`)) {
      onDelete(item.id);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold leading-tight">{item.name}</h2>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="rounded-md px-2 py-1 text-sm text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md px-2 py-1 text-sm text-red-500 active:bg-red-50 dark:active:bg-red-950"
          >
            删除
          </button>
        </div>
      </div>
      {item.note && (
        <p className="mb-3 whitespace-pre-wrap break-words text-sm text-neutral-500">
          {item.note}
        </p>
      )}
      <CopyButton code={item.code} />
    </div>
  );
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/CompositionCard.test.tsx`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 实现 `src/components/CompositionForm.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Composition } from "@/lib/compositions";

export interface CompositionFormValue {
  name: string;
  code: string;
  note: string;
}

export function CompositionForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Composition | null;
  onSubmit: (value: CompositionFormValue) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), code: code.trim(), note: note.trim() });
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="阵容名称"
        className={inputCls}
      />
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="阵容码"
        rows={3}
        className={inputCls}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）"
        rows={3}
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-base dark:border-neutral-700"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting || !name.trim() || !code.trim()}
          className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: 类型检查通过**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 7: Commit**

```bash
git add src/components/CompositionCard.tsx src/components/CompositionCard.test.tsx src/components/CompositionForm.tsx
git commit -m "feat: 阵容卡片与新增/编辑表单"
```

---

## Task 14: 主应用组装与样式

把列表、表单、复制串起来。client 组件挂载后拉取列表，CRUD 后刷新本地状态。

**Files:**
- Create: `src/components/CompositionsApp.tsx`
- Modify: `src/app/page.tsx`（替换 Task 1 的占位）

- [ ] **Step 1: 实现 `src/components/CompositionsApp.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Composition } from "@/lib/compositions";
import { CompositionCard } from "./CompositionCard";
import { CompositionForm, type CompositionFormValue } from "./CompositionForm";

export function CompositionsApp() {
  const router = useRouter();
  const [items, setItems] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Composition | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/compositions");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(item: Composition) {
    setEditing(item);
    setShowForm(true);
  }

  async function handleSubmit(value: CompositionFormValue) {
    setSubmitting(true);
    try {
      const url = editing ? `/api/compositions/${editing.id}` : "/api/compositions";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        setError("保存失败");
        return;
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/compositions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">金铲铲阵容码</h1>
      </header>

      {loading && <p className="text-center text-neutral-500">加载中…</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="mt-16 text-center text-neutral-400">还没有阵容，点右下角 + 添加</p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <CompositionCard
            key={item.id}
            item={item}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={openCreate}
          aria-label="新增阵容"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-neutral-900 text-3xl leading-none text-white shadow-lg dark:bg-white dark:text-neutral-900"
        >
          +
        </button>
      )}

      {showForm && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-neutral-900 sm:rounded-2xl">
            <h2 className="mb-3 text-lg font-semibold">
              {editing ? "编辑阵容" : "新增阵容"}
            </h2>
            <CompositionForm
              initial={editing}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: 替换 `src/app/page.tsx`**

```tsx
import { CompositionsApp } from "@/components/CompositionsApp";

export default function Home() {
  return <CompositionsApp />;
}
```

- [ ] **Step 3: 运行全部测试**

Run: `npm run test`
Expected: 所有测试 PASS（auth / validate / compositions / 两个 route / CopyButton / CompositionCard）。

- [ ] **Step 4: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 类型检查无错误；`next build` 成功，无 Edge runtime 报错（若 middleware 报 crypto 错，执行 Task 10 Step 2 注释里的 `cookie-name.ts` 拆分方案）。

- [ ] **Step 5: 端到端手动验证**

Run: `npm run dev`（`.env.local` 已配齐）。
- 未登录访问 `/` → 跳 `/login`
- 登录 → 看到空列表
- 点 + 新增一条 → 出现在列表
- 点「复制阵容码」→ 按钮变「已复制 ✓」，粘贴验证内容正确
- 点编辑改名 → 列表更新
- 点删除并确认 → 卡片消失
- 用手机浏览器访问同一 Vercel 部署地址（或局域网 dev 地址），登录后能看到同样的数据并复制

Expected: 以上全部符合。

- [ ] **Step 6: Commit**

```bash
git add src/components/CompositionsApp.tsx src/app/page.tsx
git commit -m "feat: 主应用组装（列表/新增/编辑/删除/复制）"
```

---

## Task 15: 部署说明 README

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 `README.md`**

````markdown
# 金铲铲阵容码

个人用的金铲铲阵容码收藏工具，跨设备同步，一键复制阵容码到剪贴板。

## 本地开发

1. 复制环境变量模板：`cp .env.local.example .env.local`，填入：
   - `APP_PASSWORD`：访问密码
   - `SESSION_SECRET`：随机串，可用 `openssl rand -hex 32` 生成
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`：来自 Supabase 项目设置 → API
2. 在 Supabase 的 SQL Editor 执行 `supabase/schema.sql` 建表
3. `npm install && npm run dev`

## 测试

`npm run test`

## 部署到 Vercel

1. 推送代码到 GitHub，在 Vercel 导入该仓库
2. 在 Vercel 项目 Settings → Environment Variables 配置 `APP_PASSWORD`、`SESSION_SECRET`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
3. Deploy。访问分配的 https 域名，在电脑和手机浏览器各登录一次即可。

## 安全说明

- 单用户密码门：登录下发 HMAC 签名的 httpOnly cookie（30 天）。
- 真正的鉴权在 API 层验签；middleware 仅做未登录跳转。
- Supabase service role key 只在服务端使用，不下发浏览器。
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README 与部署说明"
```

---

## 自查结果（Self-Review）

**Spec 覆盖：**
- 跨设备同步云存储 → Task 4（Supabase）+ Task 14（前端拉取）
- 单用户密码门 → Task 2（签名）/6（验签）/7（登录 API）/10（middleware）/11（登录页）
- 名称+备注+阵容码三字段 → Task 4 schema / Task 3 校验 / Task 13 表单
- 两端完整 CRUD → Task 8/9 API + Task 14 前端
- 点击复制到剪贴板 + 降级 → Task 12 CopyButton
- 移动优先 UI → Task 11/13/14 的 Tailwind 布局
- 错误处理（401/400/500、剪贴板降级、网络失败）→ 各 API 与前端均覆盖
- 部署（Next.js/Vercel/Supabase）→ Task 1 + Task 15

**占位符扫描：** 无 TBD/TODO，所有代码步骤含完整代码。

**类型一致性：** `Composition` / `CompositionInput` / `CompositionFormValue` 跨任务命名一致；`isAuthed`、`getSupabaseAdmin`、`validateCompositionInput`、`COOKIE_NAME`、`makeAuthCookieValue`、`isValidAuthCookie`、`listCompositions`/`createComposition`/`updateComposition`/`deleteComposition` 在定义与使用处签名一致。

**已知风险与缓解：** middleware 的 Edge runtime 不支持 `node:crypto`——Task 10 仅 import 常量并附拆分缓解方案；Task 14 Step 4 构建时会暴露此问题（若存在）。
