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
