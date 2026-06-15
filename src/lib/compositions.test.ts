import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listCompositions, createComposition } from "./compositions";

function fakeDb(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ order, single }));
  const insert = vi.fn(() => ({ select: vi.fn(() => ({ single })) }));
  const from = vi.fn(() => ({ select, insert }));
  return { db: { from } as unknown as SupabaseClient, from, select, order, insert };
}

describe("compositions data layer", () => {
  it("listCompositions 按 updated_at 倒序查 compositions 表", async () => {
    const rows = [{ id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t" }];
    const f = fakeDb({ data: rows, error: null });
    const result = await listCompositions(f.db);
    expect(f.from).toHaveBeenCalledWith("compositions");
    expect(f.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  it("listCompositions 在出错时抛异常", async () => {
    const f = fakeDb({ data: null, error: new Error("boom") });
    await expect(listCompositions(f.db)).rejects.toThrow("boom");
  });

  it("createComposition 插入并返回新行", async () => {
    const row = { id: "1", name: "a", note: null, code: "c", created_at: "t", updated_at: "t" };
    const f = fakeDb({ data: row, error: null });
    const result = await createComposition(f.db, { name: "a", code: "c", note: null });
    expect(f.insert).toHaveBeenCalledWith({ name: "a", code: "c", note: null });
    expect(result).toEqual(row);
  });
});
