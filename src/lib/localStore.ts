import type { Composition } from "./types";

const KEY = "jcc:compositions";
const DIRTY_KEY = "jcc:dirty";

export interface CompositionFields {
  name: string;
  code: string;
  note: string;
}

// 读本地缓存。从未存过返回 null（用于判断是否需要从云端拉种子）。
export function loadLocal(): Composition[] | null {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

export function saveLocal(items: Composition[]): void {
  localStorage.setItem(KEY, JSON.stringify({ items }));
}

export function isDirty(): boolean {
  return localStorage.getItem(DIRTY_KEY) === "1";
}

export function setDirty(value: boolean): void {
  if (value) localStorage.setItem(DIRTY_KEY, "1");
  else localStorage.removeItem(DIRTY_KEY);
}

function normalizeNote(note: string): string | null {
  const trimmed = note.trim();
  return trimmed ? trimmed : null;
}

export function createLocal(items: Composition[], input: CompositionFields): Composition[] {
  const now = new Date().toISOString();
  const item: Composition = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    code: input.code.trim(),
    note: normalizeNote(input.note),
    created_at: now,
    updated_at: now,
  };
  return [...items, item];
}

export function updateLocal(
  items: Composition[],
  id: string,
  input: CompositionFields,
): Composition[] {
  return items.map((it) =>
    it.id === id
      ? {
          ...it,
          name: input.name.trim(),
          code: input.code.trim(),
          note: normalizeNote(input.note),
          updated_at: new Date().toISOString(),
        }
      : it,
  );
}

export function deleteLocal(items: Composition[], id: string): Composition[] {
  return items.filter((it) => it.id !== id);
}
