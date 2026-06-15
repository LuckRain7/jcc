import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/guard";
import { getSupabaseAdmin } from "@/lib/supabase";
import { updateComposition, deleteComposition } from "@/lib/compositions";
import { validateCompositionInput } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, ctx: Ctx) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const result = validateCompositionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const item = await updateComposition(getSupabaseAdmin(), id, result.value);
  return NextResponse.json({ item });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  await deleteComposition(getSupabaseAdmin(), id);
  return NextResponse.json({ ok: true });
}
