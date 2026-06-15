import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/store", () => ({
  listCompositions: vi.fn(),
  replaceAllCompositions: vi.fn(),
}));

import { listCompositions, replaceAllCompositions } from "@/lib/store";
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

describe("POST /api/compositions（同步覆盖）", () => {
  it("items 不是数组返回 400", async () => {
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ items: "x" }) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("body 非法 JSON 返回 400", async () => {
    const req = new Request("http://x", { method: "POST", body: "{坏" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("合法 items 整体覆盖并返回 200", async () => {
    vi.mocked(replaceAllCompositions).mockResolvedValue(undefined);
    const items = [{ id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t" }];
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ items }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(replaceAllCompositions).toHaveBeenCalledWith(items);
  });

  it("store 抛错时返回 500", async () => {
    vi.mocked(replaceAllCompositions).mockRejectedValue(new Error("boom"));
    const req = new Request("http://x", { method: "POST", body: JSON.stringify({ items: [] }) });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
