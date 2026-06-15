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
