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
