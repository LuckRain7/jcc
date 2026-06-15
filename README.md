# 金铲铲阵容码

个人用的金铲铲阵容码收藏工具，跨设备同步，一键复制阵容码到剪贴板。电脑和手机浏览器都能完整增删改查。

## 技术栈

Next.js 15（App Router）· TypeScript · Tailwind CSS v4 · Supabase（Postgres）· Vercel · Vitest

## 本地开发

1. 复制环境变量模板：`cp .env.local.example .env.local`，填入：
   - `APP_PASSWORD`：访问密码
   - `SESSION_SECRET`：随机串，可用 `openssl rand -hex 32` 生成
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`：来自 Supabase 项目设置 → API
2. 在 Supabase 的 SQL Editor 执行 `supabase/schema.sql` 建表
3. `npm install && npm run dev`，访问 http://localhost:3000

## 测试

```bash
npm run test
```

## 部署到 Vercel

1. 推送代码到 GitHub，在 Vercel 导入该仓库
2. 在 Vercel 项目 Settings → Environment Variables 配置 `APP_PASSWORD`、`SESSION_SECRET`、`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
3. Deploy。访问分配的 https 域名，在电脑和手机浏览器各登录一次即可。

## 安全说明

- 单用户密码门：登录后下发 HMAC 签名的 httpOnly cookie（有效期 30 天）。
- 真正的鉴权在 API 层验签；middleware 仅负责未登录跳转登录页。
- Supabase service role key 只在服务端使用，不会下发到浏览器。
