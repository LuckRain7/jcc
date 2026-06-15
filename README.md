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
