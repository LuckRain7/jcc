"use client";

import { useState } from "react";
import type { Composition } from "@/lib/compositions";

export interface CompositionFormValue {
  name: string;
  code: string;
  note: string;
}

export function CompositionForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Composition | null;
  onSubmit: (value: CompositionFormValue) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name: name.trim(), code: code.trim(), note: note.trim() });
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="阵容名称"
        className={inputCls}
      />
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="阵容码"
        rows={3}
        className={inputCls}
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）"
        rows={3}
        className={inputCls}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-neutral-300 py-2.5 text-base dark:border-neutral-700"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting || !name.trim() || !code.trim()}
          className="flex-1 rounded-lg bg-neutral-900 py-2.5 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {submitting ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}
