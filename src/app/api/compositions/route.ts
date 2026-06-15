import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/guard";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listCompositions, createComposition } from "@/lib/compositions";
import { validateCompositionInput } from "@/lib/validate";

export async function GET() {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const items = await listCompositions(getSupabaseAdmin());
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const result = validateCompositionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const item = await createComposition(getSupabaseAdmin(), result.value);
  return NextResponse.json({ item }, { status: 201 });
}
