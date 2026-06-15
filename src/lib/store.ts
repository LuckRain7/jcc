import type { Composition } from "./types";

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
      "User-Agent": "jcc-app",
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
      "User-Agent": "jcc-app",
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

// 同步：用传入的 items 整体覆盖 GitHub 文件（推为主）。
// 复用 mutate 的"读 sha → 写 → 冲突重试"，apply 忽略云端现状直接返回本地 items。
export async function replaceAllCompositions(items: Composition[]): Promise<void> {
  return mutate(() => ({
    items,
    message: `chore(data): sync ${items.length} 条阵容`,
    result: undefined,
  }));
}
