import { describe, it, expect } from "vitest";
import { validateCompositionInput } from "./validate";

describe("validateCompositionInput", () => {
  it("name 与 code 都有时通过，并 trim", () => {
    const r = validateCompositionInput({ name: "  炮台  ", code: " ABC ", note: " 说明 " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ name: "炮台", code: "ABC", note: "说明" });
    }
  });

  it("note 缺省时为 null", () => {
    const r = validateCompositionInput({ name: "a", code: "b" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.note).toBeNull();
  });

  it("空 note 归一化为 null", () => {
    const r = validateCompositionInput({ name: "a", code: "b", note: "   " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.note).toBeNull();
  });

  it("缺 name 时失败", () => {
    const r = validateCompositionInput({ code: "b" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/name/);
  });

  it("缺 code 时失败", () => {
    const r = validateCompositionInput({ name: "a" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/code/);
  });

  it("body 非对象时失败", () => {
    expect(validateCompositionInput(null).ok).toBe(false);
    expect(validateCompositionInput("x").ok).toBe(false);
  });
});
