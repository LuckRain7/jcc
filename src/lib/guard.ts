import { cookies } from "next/headers";
import { COOKIE_NAME, isValidAuthCookie } from "./auth";

export async function isAuthed(): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return isValidAuthCookie(value, secret);
}
