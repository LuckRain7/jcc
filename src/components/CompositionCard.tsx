"use client";

import { useState } from "react";
import type { Composition } from "@/lib/types";

// 展示用：从阵容名剥离作者【..】、前导 # 与拼音杂字。原始 name 仍作为搜索来源，不受影响。
function parseName(raw: string): { title: string; author: string | null } {
  let s = raw.trim();
  let author: string | null = null;
  const m = s.match(/【([^】]+)】/);
  if (m) {
    author = m[1];
    s = s.replace(m[0], "");
  }
  s = s.replace(/^[a-zA-Z]+/, "").replace(/#/g, "").trim();
  return { title: s || raw, author };
}

export function CompositionCard({
  item,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  item: Composition;
  onEdit: (item: Composition) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const { title, author } = parseName(item.name);
  const pinned = Boolean(item.pinned_at);

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(item.code);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("fallback");
    }
  }

  function handleDelete() {
    setMenuOpen(false);
    if (window.confirm(`删除「${item.name}」？`)) {
      onDelete(item.id);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`复制 ${title} 阵容码`}
        className={`flex min-h-[80px] w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
          status === "copied"
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800/70 dark:bg-emerald-950/40"
            : "border-neutral-200 bg-white active:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:active:bg-neutral-800"
        }`}
      >
        <span className="line-clamp-2 pr-6 text-sm font-semibold leading-snug break-words">
          {pinned && <span className="mr-1 text-neutral-400" aria-label="已置顶">📌</span>}
          {title}
        </span>
        {item.note && (
          <span className="line-clamp-1 text-xs text-neutral-400">{item.note}</span>
        )}
        <span className="mt-auto flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-neutral-400">{author ?? "—"}</span>
          <span className="shrink-0 text-xs font-semibold text-emerald-600">
            {status === "copied" ? "已复制 ✓" : "复制"}
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="更多操作"
        aria-expanded={menuOpen}
        className="absolute right-0.5 top-0.5 rounded-md px-1.5 py-0.5 text-lg leading-none text-neutral-400 active:bg-neutral-100 dark:active:bg-neutral-800"
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute right-1 top-8 z-20 w-24 overflow-hidden rounded-lg border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onTogglePin(item.id);
              }}
              className="block w-full px-3 py-2 text-left active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              {pinned ? "取消置顶" : "置顶"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit(item);
              }}
              className="block w-full px-3 py-2 text-left active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              编辑
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="block w-full px-3 py-2 text-left text-red-500 active:bg-red-50 dark:active:bg-red-950"
            >
              删除
            </button>
          </div>
        </>
      )}

      {status === "fallback" && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 space-y-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <p className="text-xs text-neutral-500">无法自动复制，长按选中：</p>
          <input
            readOnly
            value={item.code}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
      )}
    </div>
  );
}
