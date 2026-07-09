"use client";

import { useState } from "react";
import type { Composition } from "@/lib/types";
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
  const [expanded, setExpanded] = useState(false);

  function handleDelete() {
    if (window.confirm(`删除「${item.name}」？`)) {
      onDelete(item.id);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span
            className={`shrink-0 text-neutral-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
          <span className="truncate font-medium">{item.name}</span>
        </button>
        <CopyButton code={item.code} compact />
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-neutral-100 px-3 py-3 dark:border-neutral-800">
          {item.note && (
            <p className="whitespace-pre-wrap break-words text-sm text-neutral-500">{item.note}</p>
          )}
          <div className="flex gap-1">
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
      )}
    </div>
  );
}
