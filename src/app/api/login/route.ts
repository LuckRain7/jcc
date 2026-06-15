import { NextResponse } from "next/server";
import { COOKIE_NAME, makeAuthCookieValue } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = body?.password;
  const secret = process.env.SESSION_SECRET;
  if (!secret || !process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "服务未配置密码" }, { status: 500 });
  }
  if (typeof password !== "string" || password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, makeAuthCookieValue(secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
