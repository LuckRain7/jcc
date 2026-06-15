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
