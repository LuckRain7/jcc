import { NextResponse } from "next/server";
import { listCompositions, replaceAllCompositions } from "@/lib/store";

export const dynamic = "force-dynamic";

// 拉云端全部（仅用于本地缓存为空时的种子）
export async function GET() {
  try {
    const items = await listCompositions();
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// 同步：用请求体的 items 整体覆盖云端（推为主）
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "items 必须是数组" }, { status: 400 });
  }
  try {
    await replaceAllCompositions(body.items);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
