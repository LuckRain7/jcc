import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompositionInput } from "./validate";

export interface Composition {
  id: string;
  name: string;
  note: string | null;
  code: string;
  created_at: string;
  updated_at: string;
}

const TABLE = "compositions";

export async function listCompositions(db: SupabaseClient): Promise<Composition[]> {
  const { data, error } = await db
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Composition[];
}

export async function createComposition(
  db: SupabaseClient,
  input: CompositionInput,
): Promise<Composition> {
  const { data, error } = await db
    .from(TABLE)
    .insert({ name: input.name, code: input.code, note: input.note })
    .select()
    .single();
  if (error) throw error;
  return data as Composition;
}

export async function updateComposition(
  db: SupabaseClient,
  id: string,
  input: CompositionInput,
): Promise<Composition> {
  const { data, error } = await db
    .from(TABLE)
    .update({
      name: input.name,
      code: input.code,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Composition;
}

export async function deleteComposition(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
