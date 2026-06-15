import { NextResponse } from "next/server";
import { listCompositions, createComposition } from "@/lib/store";
import { validateCompositionInput } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listCompositions();
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const result = validateCompositionInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  try {
    const item = await createComposition(result.value);
    return NextResponse.json({ item }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
