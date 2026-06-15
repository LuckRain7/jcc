import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "tft_auth";
const PAYLOAD = "tft-comp-auth";

function expectedToken(secret: string): string {
  return createHmac("sha256", secret).update(PAYLOAD).digest("hex");
}

export function makeAuthCookieValue(secret: string): string {
  return expectedToken(secret);
}

export function isValidAuthCookie(
  value: string | undefined,
  secret: string,
): boolean {
  if (!value) return false;
  const expected = expectedToken(secret);
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
