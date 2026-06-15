# GitHub 文件存储改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把存储从 Supabase 换成 GitHub 仓库里的 `data/compositions.json`（通过 GitHub Contents API 读写），并彻底移除密码验证。

**Architecture:** 新增 `src/lib/store.ts` 用 GitHub Contents API 对单一 JSON 文件做读改写（带 sha 乐观锁，冲突重试一次）。4 个 API 路由保留但去掉鉴权、改调 store。`Composition` 类型从旧的 `compositions.ts` 迁移到 `store.ts`。随后删除所有鉴权与 Supabase 代码。任务按"先加新、再切换、后删除"的顺序排列，保证每次提交都能通过构建与测试。

**Tech Stack:** Next.js 15（App Router，Node runtime 路由）、TypeScript、GitHub Contents API、Node `crypto`（`randomUUID`）、Vitest。

---

## 文件结构

```
新增:
  src/lib/store.ts                 # GitHub 文件存储：list/create/update/delete + Composition 类型
  src/lib/store.test.ts            # store 单测（mock fetch）
  data/compositions.json           # 数据文件，初始 {"items":[]}
  vercel.json                      # ignoreCommand：仅改数据文件时跳过部署

修改:
  src/app/api/compositions/route.ts            # 去鉴权，改调 store
  src/app/api/compositions/route.test.ts       # 去 401 用例，mock store
  src/app/api/compositions/[id]/route.ts       # 去鉴权，改调 store
  src/app/api/compositions/[id]/route.test.ts  # 去 401 用例，mock store
  src/components/CompositionsApp.tsx           # 去 401/useRouter，Composition 改从 store 导入
  src/components/CompositionCard.tsx           # Composition 改从 store 导入
  src/components/CompositionForm.tsx           # Composition 改从 store 导入
  .env.local.example                           # 改为 GITHUB_* 变量
  README.md                                    # 更新存储/部署/安全说明

删除:
  src/app/login/page.tsx
  src/middleware.ts
  src/lib/auth.ts, src/lib/auth.test.ts
  src/lib/guard.ts
  src/lib/cookie-name.ts
  src/app/api/login/route.ts
  src/app/api/logout/route.ts
  src/lib/supabase.ts
  src/lib/compositions.ts, src/lib/compositions.test.ts
  supabase/schema.sql
  package.json 中的 @supabase/supabase-js 依赖
```

---

## Task 1: GitHub 文件存储 store.ts（TDD）

**Files:**
- Create: `src/lib/store.ts`
- Test: `src/lib/store.test.ts`

- [ ] **Step 1: 写失败的测试 `src/lib/store.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { listCompositions, createComposition } from "./store";

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64");

beforeEach(() => {
  process.env.GITHUB_TOKEN = "tok";
  process.env.GITHUB_REPO = "owner/repo";
  process.env.GITHUB_BRANCH = "master";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("store", () => {
  it("listCompositions 解码并按 updated_at 倒序", async () => {
    const items = [
      { id: "1", name: "a", note: null, code: "c1", created_at: "t", updated_at: "2024-01-01T00:00:00Z" },
      { id: "2", name: "b", note: null, code: "c2", created_at: "t", updated_at: "2024-02-01T00:00:00Z" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ content: b64({ items }), sha: "s" }),
    }));
    const result = await listCompositions();
    expect(result.map((r) => r.id)).toEqual(["2", "1"]);
  });

  it("文件不存在(404)时返回空列表", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    expect(await listCompositions()).toEqual([]);
  });

  it("createComposition 追加并 PUT，body 含 base64 content 与 sha", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: b64({ items: [] }), sha: "sha1" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const item = await createComposition({ name: "x", code: "y", note: null });
    expect(item.name).toBe("x");
    expect(item.id).toBeTruthy();
    const putArgs = fetchMock.mock.calls[1][1];
    expect(putArgs.method).toBe("PUT");
    const putBody = JSON.parse(putArgs.body);
    expect(putBody.sha).toBe("sha1");
    const written = JSON.parse(Buffer.from(putBody.content, "base64").toString("utf-8"));
    expect(written.items).toHaveLength(1);
    expect(written.items[0].name).toBe("x");
  });

  it("写冲突(409)时重新读取 sha 并重试一次", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: b64({ items: [] }), sha: "old" }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ content: b64({ items: [] }), sha: "new" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const item = await createComposition({ name: "x", code: "y", note: null });
    expect(item.name).toBe("x");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const secondPut = JSON.parse(fetchMock.mock.calls[3][1].body);
    expect(secondPut.sha).toBe("new");
  });

  it("缺少 GITHUB_TOKEN 时抛错", async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(listCompositions()).rejects.toThrow(/GITHUB_TOKEN/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/store.test.ts`
Expected: FAIL（`./store` 不存在）。

- [ ] **Step 3: 实现 `src/lib/store.ts`**

```ts
import { randomUUID } from "crypto";
import type { CompositionInput } from "./validate";

export interface Composition {
  id: string;
  name: string;
  note: string | null;
  code: string;
  created_at: string;
  updated_at: string;
}

const DATA_PATH = "data/compositions.json";

interface RepoConfig {
  token: string;
  repo: string;
  branch: string;
}

function getConfig(): RepoConfig {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH ?? "master";
  if (!token) throw new Error("缺少 GITHUB_TOKEN 环境变量");
  if (!repo) throw new Error("缺少 GITHUB_REPO 环境变量");
  return { token, repo, branch };
}

interface FileState {
  items: Composition[];
  sha: string | undefined;
}

async function readFile(cfg: RepoConfig): Promise<FileState> {
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${DATA_PATH}?ref=${cfg.branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (res.status === 404) return { items: [], sha: undefined };
  if (!res.ok) throw new Error(`GitHub 读取失败: ${res.status}`);
  const json = await res.json();
  const content = Buffer.from(json.content, "base64").toString("utf-8");
  const parsed = content.trim() ? JSON.parse(content) : { items: [] };
  return { items: parsed.items ?? [], sha: json.sha };
}

async function writeFile(
  cfg: RepoConfig,
  items: Composition[],
  sha: string | undefined,
  message: string,
): Promise<void> {
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${DATA_PATH}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify({ items }, null, 2)).toString("base64"),
    branch: cfg.branch,
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`GitHub 写入失败: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
}

// 读-改-写，sha 冲突(409/422)时用最新 sha 重做一次
async function mutate<T>(
  apply: (items: Composition[]) => { items: Composition[]; message: string; result: T },
): Promise<T> {
  const cfg = getConfig();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { items, sha } = await readFile(cfg);
    const { items: next, message, result } = apply(items);
    try {
      await writeFile(cfg, next, sha, message);
      return result;
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if ((status === 409 || status === 422) && attempt === 0) continue;
      throw e;
    }
  }
  throw lastErr;
}

export async function listCompositions(): Promise<Composition[]> {
  const cfg = getConfig();
  const { items } = await readFile(cfg);
  return [...items].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function createComposition(input: CompositionInput): Promise<Composition> {
  return mutate((items) => {
    const now = new Date().toISOString();
    const item: Composition = {
      id: randomUUID(),
      name: input.name,
      note: input.note,
      code: input.code,
      created_at: now,
      updated_at: now,
    };
    return { items: [...items, item], message: `chore(data): add ${input.name}`, result: item };
  });
}

export async function updateComposition(id: string, input: CompositionInput): Promise<Composition> {
  return mutate((items) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error("阵容不存在");
    const updated: Composition = {
      ...items[idx],
      name: input.name,
      code: input.code,
      note: input.note,
      updated_at: new Date().toISOString(),
    };
    const next = [...items];
    next[idx] = updated;
    return { items: next, message: `chore(data): update ${input.name}`, result: updated };
  });
}

export async function deleteComposition(id: string): Promise<void> {
  return mutate((items) => ({
    items: items.filter((i) => i.id !== id),
    message: `chore(data): delete ${id}`,
    result: undefined,
  }));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/lib/store.test.ts`
Expected: PASS（5 个用例）。

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。（旧的 `compositions.ts` 仍在，不受影响。）

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.ts src/lib/store.test.ts
git commit -m "feat: GitHub 文件存储 store（含 sha 冲突重试）"
```

---

## Task 2: API 路由改调 store、去鉴权

**Files:**
- Modify: `src/app/api/compositions/route.ts`, `src/app/api/compositions/route.test.ts`
- Modify: `src/app/api/compositions/[id]/route.ts`, `src/app/api/compositions/[id]/route.test.ts`

- [ ] **Step 1: 改写集合路由测试 `src/app/api/compositions/route.test.ts`（整文件替换）**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/store", () => ({
  listCompositions: vi.fn(),
  createComposition: vi.fn(),
}));

import { listCompositions, createComposition } from "@/lib/store";
import { GET, POST } from "./route";

beforeEach(() => vi.clearAllMocks());

describe("GET /api/compositions", () => {
  it("返回列表", async () => {
    vi.mocked(listCompositions).mockResolvedValue([
      { id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
  });

  it("store 抛错时返回 500", async () => {
    vi.mocked(listCompositions).mockRejectedValue(new Error("boom"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/compositions", () => {
  it("参数非法返回 400", async () => {
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ name: "" }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("合法参数创建并返回 201", async () => {
    vi.mocked(createComposition).mockResolvedValue({
      id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t",
    });
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ name: "a", code: "c" }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.item.id).toBe("1");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/api/compositions/route.test.ts`
Expected: FAIL（当前 route 仍引用 guard/compositions，mock 不匹配，断言失败或导入报错）。

- [ ] **Step 3: 改写集合路由 `src/app/api/compositions/route.ts`（整文件替换）**

```ts
import { NextResponse } from "next/server";
import { listCompositions, createComposition } from "@/lib/store";
import { validateCompositionInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listCompositions();
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const result = validateCompositionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  try {
    const item = await createComposition(result.value);
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/app/api/compositions/route.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 5: 改写单条路由测试 `src/app/api/compositions/[id]/route.test.ts`（整文件替换）**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/store", () => ({
  updateComposition: vi.fn(),
  deleteComposition: vi.fn(),
}));

import { updateComposition, deleteComposition } from "@/lib/store";
import { PUT, DELETE } from "./route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
beforeEach(() => vi.clearAllMocks());

describe("PUT /api/compositions/[id]", () => {
  it("参数非法返回 400", async () => {
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(400);
  });

  it("合法参数更新并返回 200", async () => {
    vi.mocked(updateComposition).mockResolvedValue({
      id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t",
    });
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "a", code: "c" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(200);
    expect(updateComposition).toHaveBeenCalledWith("1", { name: "a", code: "c", note: null });
  });

  it("store 抛错时返回 500", async () => {
    vi.mocked(updateComposition).mockRejectedValue(new Error("boom"));
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "a", code: "c" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/compositions/[id]", () => {
  it("删除并返回 200", async () => {
    vi.mocked(deleteComposition).mockResolvedValue(undefined);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(deleteComposition).toHaveBeenCalledWith("1");
  });
});
```

- [ ] **Step 6: 运行测试确认失败**

Run: `npx vitest run "src/app/api/compositions/[id]/route.test.ts"`
Expected: FAIL（旧 route 仍引用 guard/compositions）。

- [ ] **Step 7: 改写单条路由 `src/app/api/compositions/[id]/route.ts`（整文件替换）**

```ts
import { NextResponse } from "next/server";
import { updateComposition, deleteComposition } from "@/lib/store";
import { validateCompositionInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const result = validateCompositionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  try {
    const item = await updateComposition(id, result.value);
    return NextResponse.json({ item });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await deleteComposition(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 8: 运行测试确认通过**

Run: `npx vitest run "src/app/api/compositions/[id]/route.test.ts"`
Expected: PASS（4 个用例）。

- [ ] **Step 9: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 10: Commit**

```bash
git add src/app/api/compositions/route.ts src/app/api/compositions/route.test.ts "src/app/api/compositions/[id]/route.ts" "src/app/api/compositions/[id]/route.test.ts"
git commit -m "feat: API 路由改用 GitHub 存储并移除鉴权"
```

---

## Task 3: 组件迁移 Composition 类型来源、去掉 401/useRouter

**Files:**
- Modify: `src/components/CompositionsApp.tsx`, `src/components/CompositionCard.tsx`, `src/components/CompositionForm.tsx`

- [ ] **Step 1: `CompositionCard.tsx` 改导入来源**

把：
```tsx
import type { Composition } from "@/lib/compositions";
```
改为：
```tsx
import type { Composition } from "@/lib/store";
```

- [ ] **Step 2: `CompositionForm.tsx` 改导入来源**

把：
```tsx
import type { Composition } from "@/lib/compositions";
```
改为：
```tsx
import type { Composition } from "@/lib/store";
```

- [ ] **Step 3: `CompositionsApp.tsx` 改导入块**

把：
```tsx
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Composition } from "@/lib/compositions";
```
改为：
```tsx
import { useEffect, useState, useCallback } from "react";
import type { Composition } from "@/lib/store";
```

- [ ] **Step 4: `CompositionsApp.tsx` 删除 router 声明**

把：
```tsx
  const router = useRouter();
  const [items, setItems] = useState<Composition[]>([]);
```
改为：
```tsx
  const [items, setItems] = useState<Composition[]>([]);
```

- [ ] **Step 5: `CompositionsApp.tsx` 改 load()（去 401，依赖数组改空）**

把：
```tsx
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
```
改为：
```tsx
      const res = await fetch("/api/compositions");
      if (!res.ok) {
        setError("加载失败，请重试");
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, []);
```

- [ ] **Step 6: `CompositionsApp.tsx` 改 handleSubmit（去 401）**

把：
```tsx
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setError("保存失败");
        return;
      }
```
改为：
```tsx
      if (!res.ok) {
        setError("保存失败");
        return;
      }
```

- [ ] **Step 7: `CompositionsApp.tsx` 改 handleDelete（去 401）**

把：
```tsx
    const res = await fetch(`/api/compositions/${id}`, { method: "DELETE" });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (res.ok) {
```
改为：
```tsx
    const res = await fetch(`/api/compositions/${id}`, { method: "DELETE" });
    if (res.ok) {
```

- [ ] **Step 8: 类型检查 + 全量测试**

Run: `npx tsc --noEmit && npm run test`
Expected: tsc 无错误；测试全绿（旧 auth/compositions 测试此时仍在，也应通过，因为相关源文件尚未删除）。

- [ ] **Step 9: Commit**

```bash
git add src/components/CompositionsApp.tsx src/components/CompositionCard.tsx src/components/CompositionForm.tsx
git commit -m "refactor: 组件改用 store 的 Composition 类型并移除登录跳转"
```

---

## Task 4: 删除鉴权与 Supabase 代码、卸载依赖

此时 API 路由与组件都已切到 store，下列文件无人引用，可安全删除。

**Files:**
- Delete: 见下方命令
- Modify: `package.json`（卸载 supabase 依赖）

- [ ] **Step 1: 删除文件**

```bash
git rm src/app/login/page.tsx \
  src/middleware.ts \
  src/lib/auth.ts src/lib/auth.test.ts \
  src/lib/guard.ts \
  src/lib/cookie-name.ts \
  src/app/api/login/route.ts \
  src/app/api/logout/route.ts \
  src/lib/supabase.ts \
  src/lib/compositions.ts src/lib/compositions.test.ts \
  supabase/schema.sql
```
（`supabase/` 目录删空后会自动消失；`login/`、`api/login/`、`api/logout/` 同理。）

- [ ] **Step 2: 卸载 Supabase 依赖**

Run: `npm uninstall @supabase/supabase-js`
Expected: `package.json` 的 dependencies 中不再有 `@supabase/supabase-js`。

- [ ] **Step 3: 确认无残留引用**

Run: `grep -rn "lib/auth\|lib/guard\|lib/supabase\|lib/cookie-name\|lib/compositions\|@supabase" src` 
Expected: 无输出（没有任何文件再引用这些已删除模块）。

- [ ] **Step 4: 全量测试 + 类型检查 + 构建**

Run: `npm run test && npx tsc --noEmit && npm run build`
Expected: 测试全绿（store + validate + 两个 route + CopyButton + CompositionCard）；tsc 无错误；build 成功，无 middleware（已删除），无 Edge 警告。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: 删除鉴权与 Supabase 代码，卸载 supabase 依赖"
```

---

## Task 5: 数据文件与 vercel.json

**Files:**
- Create: `data/compositions.json`, `vercel.json`

- [ ] **Step 1: 创建 `data/compositions.json`**

内容（注意结尾换行）：
```json
{ "items": [] }
```

- [ ] **Step 2: 创建 `vercel.json`**

```json
{
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ':!data/compositions.json'"
}
```
说明：该命令退出码 0（仅数据文件变化）时 Vercel 跳过构建；退出码 1（有其他文件变化）时正常构建。

- [ ] **Step 3: 校验 vercel.json 是合法 JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: 输出 `ok`。

- [ ] **Step 4: Commit**

```bash
git add data/compositions.json vercel.json
git commit -m "chore: 初始化数据文件与 vercel ignoreCommand"
```

---

## Task 6: 更新环境变量模板与 README

**Files:**
- Modify: `.env.local.example`, `README.md`

- [ ] **Step 1: 整文件替换 `.env.local.example`**

```
# GitHub 细粒度 PAT，对存数据的仓库授予 Contents: Read and write 权限
GITHUB_TOKEN=github_pat_xxx
# 存数据的仓库，格式 owner/repo
GITHUB_REPO=LuckRain7/jcc
# 数据所在分支
GITHUB_BRANCH=master
```

- [ ] **Step 2: 整文件替换 `README.md`**

````markdown
# 金铲铲阵容码

个人用的金铲铲阵容码收藏工具：跨设备同步、一键复制阵容码到剪贴板，电脑和手机浏览器都能完整增删改查。数据存在本仓库的 `data/compositions.json`，通过 GitHub API 读写，无需数据库。无登录验证（数据非隐私）。

## 技术栈

Next.js 15（App Router）· TypeScript · Tailwind CSS v4 · GitHub Contents API（数据存储）· Vercel · Vitest

## 本地开发

1. 复制环境变量模板：`cp .env.local.example .env.local`，填入：
   - `GITHUB_TOKEN`：GitHub 细粒度 PAT，对本仓库授予 **Contents: Read and write**（GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens）
   - `GITHUB_REPO`：`LuckRain7/jcc`
   - `GITHUB_BRANCH`：`master`
2. `npm install && npm run dev`，访问 http://localhost:3000

> 注意：本地开发时的增删改会直接写到 GitHub 上的 `master` 分支（线上同一份数据）。

## 测试

```bash
npm run test
```

## 部署到 Vercel

1. 在 Vercel 导入本 GitHub 仓库
2. Settings → Environment Variables 配置 `GITHUB_TOKEN`、`GITHUB_REPO`、`GITHUB_BRANCH`
3. Deploy。`vercel.json` 的 `ignoreCommand` 会让"仅修改数据文件"的提交跳过重新部署。

## 说明

- 数据写入会向仓库提交 commit（commit message 形如 `chore(data): add 阵容名`）。
- 无鉴权：任何能访问网址的人都能增删改阵容；`GITHUB_TOKEN` 只在服务端 API 路由使用，不会下发浏览器。
- 单用户使用，写入用 sha 乐观锁，冲突自动重试一次。
````

- [ ] **Step 3: 最终全量验证**

Run: `npm run test && npx tsc --noEmit && npm run build`
Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add .env.local.example README.md
git commit -m "docs: 更新环境变量与 README 为 GitHub 存储"
```

---

## 自查结果（Self-Review）

**Spec 覆盖：**
- GitHub 文件读写 + sha 乐观锁 + 冲突重试 → Task 1（store.ts）
- 移除鉴权 → Task 2（路由去 401）+ Task 3（前端去跳转）+ Task 4（删文件）
- 移除 Supabase → Task 4（删文件 + 卸依赖）
- 数据文件 `data/compositions.json` → Task 5
- vercel.json ignoreCommand → Task 5
- 环境变量 GITHUB_* + 文档 → Task 6
- 测试（store mock fetch、路由去 401、保留 validate/CopyButton/Card）→ Task 1/2 + Task 4 Step 4 验证保留项

**占位符扫描：** 无 TBD/TODO，所有步骤含完整代码或精确改动。

**类型一致性：** `Composition`（store.ts 定义）字段与旧定义一致，组件改为从 `@/lib/store` 导入；`CompositionInput` 继续来自 `validate.ts`，未改动；store 函数签名 `listCompositions()`/`createComposition(input)`/`updateComposition(id,input)`/`deleteComposition(id)` 在路由与测试中调用一致。

**顺序保证绿色：** Task 1 新增不破坏现有；Task 2 切路由（旧 compositions.ts 仍在，仅不再被引用）；Task 3 切组件类型来源；Task 4 此时无人引用旧模块才删除。每个任务末尾都有 tsc/test 验证。

**已知风险：** `vercel.json` 用 `HEAD^`，Vercel 浅克隆极端情况下可能取不到父提交；若线上发现 ignoreCommand 不生效，改用 Vercel 后台 Ignored Build Step 或带兜底的命令。已在设计文档记录。
