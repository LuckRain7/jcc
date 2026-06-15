"use client";

import type { Composition } from "@/lib/store";
import { CopyButton } from "./CopyButton";

export function CompositionCard({
  item,
  onEdit,
  onDelete,
}: {
  item: Composition;
  onEdit: (item: Composition) => void;
  onDelete: (id: string) => void;
}) {
  function handleDelete() {
    if (window.confirm(`删除「${item.name}」？`)) {
      onDelete(item.id);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold leading-tight">{item.name}</h2>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="rounded-md px-2 py-1 text-sm text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-md px-2 py-1 text-sm text-red-500 active:bg-red-50 dark:active:bg-red-950"
          >
            删除
          </button>
        </div>
      </div>
      {item.note && (
        <p className="mb-3 whitespace-pre-wrap break-words text-sm text-neutral-500">
          {item.note}
        </p>
      )}
      <CopyButton code={item.code} />
    </div>
  );
}
