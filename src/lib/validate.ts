export interface CompositionInput {
  name: string;
  code: string;
  note: string | null;
}

export type ValidateResult =
  | { ok: true; value: CompositionInput }
  | { ok: false; error: string };

export function validateCompositionInput(body: unknown): ValidateResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid body" };
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const code = typeof b.code === "string" ? b.code.trim() : "";
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (!name) return { ok: false, error: "name is required" };
  if (!code) return { ok: false, error: "code is required" };
  return { ok: true, value: { name, code, note: note || null } };
}
