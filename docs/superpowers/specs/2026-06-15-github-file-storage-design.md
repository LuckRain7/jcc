# 金铲铲阵容码：改用 GitHub 文件存储（移除验证与 Supabase）设计文档

日期：2026-06-15

## 1. 背景与目标

把数据存储从 Supabase（Postgres）换成 **GitHub 仓库里的一个 JSON 文件**，并**移除密码验证**。起因：Supabase 免费项目会因闲置被暂停，维护麻烦；阵容数据不属于隐私，无需鉴权。

- 数据存在当前公开仓库 `LuckRain7/jcc` 的 `master` 分支，文件 `data/compositions.json`。
- 通过 GitHub Contents API 在服务端读写。
- 应用完全开放，无登录。

### 已知后果（用户已确认接受）
- 无验证 → 任何知道网址的人都能增删改阵容（写操作走服务端的 GitHub token）。数据非隐私，可接受。
- 数据文件公开可见。可接受。

### 范围约束 / 非目标（YAGNI）
- 不做多文件、不做数据路径环境变量（路径写死）。
- 不做乐观锁以外的并发控制（单用户）。
- 不保留任何 Supabase 或鉴权代码。

## 2. 删除项

**鉴权相关**：`src/app/login/page.tsx`、`src/middleware.ts`、`src/lib/auth.ts`、`src/lib/auth.test.ts`、`src/lib/guard.ts`、`src/lib/cookie-name.ts`、`src/app/api/login/route.ts`、`src/app/api/logout/route.ts`。

**Supabase 相关**：`src/lib/supabase.ts`、`supabase/schema.sql`（及空目录）、`package.json` 中的 `@supabase/supabase-js` 依赖。

**前端**：`CompositionsApp.tsx` 中所有 `res.status === 401 → router.replace("/login")` 分支与相关 `useRouter` 用法（若不再需要）。

## 3. 架构

- 新存储模块 `src/lib/store.ts`，封装 GitHub Contents API，读写 `data/compositions.json`。
- 4 个 API 路由保留但去掉鉴权，改调 `store.ts`：
  - `GET /api/compositions`、`POST /api/compositions`
  - `PUT /api/compositions/[id]`、`DELETE /api/compositions/[id]`
- `vercel.json` 增加 `ignoreCommand`，当某次提交只改了 `data/compositions.json` 时跳过部署。
- `Composition` / `CompositionInput` 类型沿用（`CompositionInput` 来自 `validate.ts`，保持不变）。

## 4. 数据模型与文件

文件 `data/compositions.json`：
```json
{ "items": [
  { "id": "uuid", "name": "娑娜炮台", "note": "三星核心", "code": "TFTSET...", "created_at": "ISO", "updated_at": "ISO" }
] }
```
- 初始内容 `{"items":[]}`，随本次改造一并创建并提交到 `master`。
- `Composition` 字段：`id, name, note: string|null, code, created_at, updated_at`（与现有类型一致）。

## 5. 存储模块 store.ts 行为

依赖环境变量：`GITHUB_TOKEN`、`GITHUB_REPO`（如 `LuckRain7/jcc`）、`GITHUB_BRANCH`（如 `master`）。数据路径常量 `DATA_PATH = "data/compositions.json"`。

GitHub Contents API 端点：`GET/PUT https://api.github.com/repos/{repo}/contents/{path}`，请求头 `Authorization: Bearer {token}`、`Accept: application/vnd.github+json`。

- `readFile()`：GET 该路径（带 `?ref={branch}`）→ 返回 `{ items, sha }`。base64 解码 `content` 字段并 `JSON.parse`。若文件不存在（404）→ 返回 `{ items: [], sha: undefined }`。
- `writeFile(items, sha, message)`：PUT，body 含 `message`、`content`（`JSON.stringify({items}, null, 2)` 的 base64）、`branch`，以及（若有）`sha`。返回新 `sha`。
- `listCompositions()`：`readFile().items` 按 `updated_at` 倒序返回。
- `createComposition(input)`：`readFile()` → 追加 `{ id: randomUUID(), ...input, created_at: now, updated_at: now }` → `writeFile`，commit message `chore(data): add {name}` → 返回新项。
- `updateComposition(id, input)`：`readFile()` → 找到项，更新字段与 `updated_at` → `writeFile`，message `chore(data): update {name}` → 返回更新后项。找不到 → 抛错（路由转 404 或 500）。
- `deleteComposition(id)`：`readFile()` → 过滤掉该 id → `writeFile`，message `chore(data): delete {id}`。

**并发冲突重试**：`writeFile` 收到 409/422（sha 冲突）时，由 create/update/delete 重新 `readFile()` 取最新 sha，在最新 items 上重做一次该操作并再 PUT 一次；仍失败则抛错。最多重试 1 次。

`randomUUID` 与时间戳：`import { randomUUID } from "crypto"`；时间用 `new Date().toISOString()`。

## 6. API 路由（去鉴权后）

- `GET /api/compositions` → `{ items }`，200。
- `POST /api/compositions` → 校验 body（`validateCompositionInput`），非法 400；否则 `createComposition` → `{ item }`，201。
- `PUT /api/compositions/[id]` → 校验 body，非法 400；`updateComposition` → `{ item }`，200。
- `DELETE /api/compositions/[id]` → `deleteComposition` → `{ ok: true }`，200。
- 任一处缺 `GITHUB_TOKEN` 或 GitHub 报错 → 500 `{ error }`。

## 7. vercel.json

```json
{
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ':!data/compositions.json'"
}
```
语义：该命令退出码为 0（即"除数据文件外没有改动"）时 Vercel **跳过**构建；退出码为 1（有其他文件改动）时**继续**构建。即仅改数据文件的提交不会触发重新部署。

## 8. 错误处理

- 缺 `GITHUB_TOKEN` / `GITHUB_REPO` → store 抛错 → 路由 500。
- GitHub 4xx/5xx → store 抛带状态码信息的错误 → 路由 500。
- 写冲突重试 1 次仍失败 → 抛错 → 500，前端 toast 提示「保存失败」。
- 前端：删除原 401 跳转；网络/保存失败保留原有 `setError` 提示。

## 9. 测试

- `store.test.ts`：mock 全局 `fetch`，覆盖：
  - `listCompositions` 解码 base64 + 按 updated_at 倒序。
  - `createComposition` 追加并 PUT，校验 PUT body 含 base64 content 与 sha。
  - `updateComposition` / `deleteComposition` 修改正确项。
  - 写冲突（首个 PUT 返回 409）→ 重新读 sha → 第二次 PUT 成功。
- API 路由测试：mock `@/lib/store`，测状态码与 JSON 形状；**删除所有 401 用例**。
- 保留 `validate.test.ts`、`CopyButton.test.tsx`、`CompositionCard.test.tsx`。

## 10. 环境变量与部署

- 本地 `.env.local` 与 Vercel 均配置：`GITHUB_TOKEN`、`GITHUB_REPO=LuckRain7/jcc`、`GITHUB_BRANCH=master`。
- `GITHUB_TOKEN`：fine-grained PAT，对 `LuckRain7/jcc` 授予 **Contents: Read and write**。
- 更新 `.env.local.example` 与 `README.md`，移除 Supabase/密码相关说明。
