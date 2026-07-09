"use client";

import { useState } from "react";

export function CopyButton({ code, compact = false }: { code: string; compact?: boolean }) {
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(code);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("fallback");
    }
  }

  return (
    <div className={compact ? "relative shrink-0" : "space-y-2"}>
      <button
        type="button"
        onClick={handleCopy}
        className={
          compact
            ? `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                status === "copied" ? "bg-emerald-500" : "bg-emerald-600 active:bg-emerald-700"
              }`
            : "w-full rounded-lg bg-emerald-600 py-3 text-base font-medium text-white active:bg-emerald-700"
        }
      >
        {status === "copied" ? "已复制 ✓" : compact ? "复制" : "复制阵容码"}
      </button>
      {status === "fallback" && (
        <div
          className={
            compact
              ? "absolute right-0 top-full z-10 mt-1 w-64 space-y-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
              : "space-y-1"
          }
        >
          <p className="text-xs text-neutral-500">
            {compact ? "无法自动复制，请长按选中：" : "无法自动复制，请长按下方选中复制："}
          </p>
          <input
            readOnly
            value={code}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded border border-neutral-300 bg-white px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
      )}
    </div>
  );
}
