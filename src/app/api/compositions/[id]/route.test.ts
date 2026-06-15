import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/guard", () => ({ isAuthed: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: vi.fn(() => ({})) }));
vi.mock("@/lib/compositions", () => ({
  updateComposition: vi.fn(),
  deleteComposition: vi.fn(),
}));

import { isAuthed } from "@/lib/guard";
import { updateComposition, deleteComposition } from "@/lib/compositions";
import { PUT, DELETE } from "./route";

const authed = vi.mocked(isAuthed);
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe("PUT /api/compositions/[id]", () => {
  it("未登录返回 401", async () => {
    authed.mockResolvedValue(false);
    const req = new Request("http://x", { method: "PUT", body: "{}" });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(401);
  });

  it("参数非法返回 400", async () => {
    authed.mockResolvedValue(true);
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(400);
  });

  it("合法参数更新并返回 200", async () => {
    authed.mockResolvedValue(true);
    vi.mocked(updateComposition).mockResolvedValue({
      id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t",
    });
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "a", code: "c" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(200);
    expect(updateComposition).toHaveBeenCalledWith(expect.anything(), "1", {
      name: "a", code: "c", note: null,
    });
  });
});

describe("DELETE /api/compositions/[id]", () => {
  it("未登录返回 401", async () => {
    authed.mockResolvedValue(false);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(401);
  });

  it("已登录删除并返回 200", async () => {
    authed.mockResolvedValue(true);
    vi.mocked(deleteComposition).mockResolvedValue(undefined);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(deleteComposition).toHaveBeenCalledWith(expect.anything(), "1");
  });
});
