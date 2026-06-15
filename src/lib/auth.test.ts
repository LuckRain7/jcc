import { describe, it, expect } from "vitest";
import { COOKIE_NAME, makeAuthCookieValue, isValidAuthCookie } from "./auth";

describe("auth cookie", () => {
  const secret = "test-secret-123";

  it("COOKIE_NAME 是稳定的字符串", () => {
    expect(COOKIE_NAME).toBe("tft_auth");
  });

  it("makeAuthCookieValue 对同一 secret 是确定性的", () => {
    expect(makeAuthCookieValue(secret)).toBe(makeAuthCookieValue(secret));
  });

  it("用正确的值验签通过", () => {
    const value = makeAuthCookieValue(secret);
    expect(isValidAuthCookie(value, secret)).toBe(true);
  });

  it("用错误的值验签失败", () => {
    expect(isValidAuthCookie("deadbeef", secret)).toBe(false);
  });

  it("用不同 secret 验签失败", () => {
    const value = makeAuthCookieValue(secret);
    expect(isValidAuthCookie(value, "other-secret")).toBe(false);
  });

  it("undefined / 空值验签失败", () => {
    expect(isValidAuthCookie(undefined, secret)).toBe(false);
    expect(isValidAuthCookie("", secret)).toBe(false);
  });
});
