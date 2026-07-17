import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLocal,
  saveLocal,
  isDirty,
  setDirty,
  createLocal,
  updateLocal,
  deleteLocal,
  togglePin,
} from "./localStore";
import type { Composition } from "./types";

beforeEach(() => {
  localStorage.clear();
});

const sample: Composition = {
  id: "1",
  name: "a",
  note: null,
  code: "c",
  created_at: "t",
  updated_at: "t",
};

describe("localStore 读写", () => {
  it("从未存过时 loadLocal 返回 null", () => {
    expect(loadLocal()).toBeNull();
  });

  it("saveLocal 后 loadLocal 取回同样的 items", () => {
    saveLocal([sample]);
    expect(loadLocal()).toEqual([sample]);
  });

  it("存空数组后 loadLocal 返回空数组（不是 null）", () => {
    saveLocal([]);
    expect(loadLocal()).toEqual([]);
  });

  it("损坏的 JSON 返回空数组", () => {
    localStorage.setItem("jcc:compositions", "{坏掉的");
    expect(loadLocal()).toEqual([]);
  });
});

describe("dirty 标记", () => {
  it("默认不脏；setDirty(true) 后为脏；setDirty(false) 后清除", () => {
    expect(isDirty()).toBe(false);
    setDirty(true);
    expect(isDirty()).toBe(true);
    setDirty(false);
    expect(isDirty()).toBe(false);
  });
});

describe("CRUD 纯函数", () => {
  it("createLocal 追加新项，生成 id 与时间戳，并 trim/归一化 note", () => {
    const next = createLocal([], { name: "  炮台 ", code: " ABC ", note: "  " });
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe("炮台");
    expect(next[0].code).toBe("ABC");
    expect(next[0].note).toBeNull();
    expect(next[0].id).toBeTruthy();
    expect(next[0].created_at).toBeTruthy();
  });

  it("createLocal 保留非空 note", () => {
    const next = createLocal([], { name: "n", code: "c", note: " 说明 " });
    expect(next[0].note).toBe("说明");
  });

  it("updateLocal 只改目标项并刷新 updated_at", () => {
    const start = createLocal([], { name: "old", code: "c", note: "" });
    const id = start[0].id;
    const next = updateLocal(start, id, { name: "new", code: "c2", note: "n" });
    expect(next[0].name).toBe("new");
    expect(next[0].code).toBe("c2");
    expect(next[0].note).toBe("n");
    expect(next[0].id).toBe(id);
  });

  it("deleteLocal 移除指定项", () => {
    const start = [sample, { ...sample, id: "2" }];
    expect(deleteLocal(start, "1").map((i) => i.id)).toEqual(["2"]);
  });

  it("togglePin 首次置顶写入时间戳，再次调用取消置顶", () => {
    const pinned = togglePin([sample], "1");
    expect(pinned[0].pinned_at).toBeTruthy();
    const unpinned = togglePin(pinned, "1");
    expect(unpinned[0].pinned_at).toBeNull();
  });

  it("togglePin 只影响目标项且不改动 updated_at", () => {
    const start = [sample, { ...sample, id: "2" }];
    const next = togglePin(start, "2");
    expect(next[0].pinned_at).toBeUndefined();
    expect(next[1].pinned_at).toBeTruthy();
    expect(next[1].updated_at).toBe(sample.updated_at);
  });
});
