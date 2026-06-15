import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/cookie-name";

export function middleware(req: NextRequest) {
  const value = req.cookies.get(COOKIE_NAME)?.value;
  if (value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // 放行登录页、所有 API、Next 静态资源
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
