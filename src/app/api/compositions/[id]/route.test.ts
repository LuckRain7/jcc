import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/store", () => ({
  updateComposition: vi.fn(),
  deleteComposition: vi.fn(),
}));

import { updateComposition, deleteComposition } from "@/lib/store";
import { PUT, DELETE } from "./route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
beforeEach(() => vi.clearAllMocks());

describe("PUT /api/compositions/[id]", () => {
  it("参数非法返回 400", async () => {
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(400);
  });

  it("合法参数更新并返回 200", async () => {
    vi.mocked(updateComposition).mockResolvedValue({
      id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t",
    });
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "a", code: "c" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(200);
    expect(updateComposition).toHaveBeenCalledWith("1", { name: "a", code: "c", note: null });
  });

  it("store 抛错时返回 500", async () => {
    vi.mocked(updateComposition).mockRejectedValue(new Error("boom"));
    const req = new Request("http://x", { method: "PUT", body: JSON.stringify({ name: "a", code: "c" }) });
    const res = await PUT(req, ctx("1"));
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/compositions/[id]", () => {
  it("删除并返回 200", async () => {
    vi.mocked(deleteComposition).mockResolvedValue(undefined);
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), ctx("1"));
    expect(res.status).toBe(200);
    expect(deleteComposition).toHaveBeenCalledWith("1");
  });
});
