"use client";

import React, { useState } from "react";

export function CopyButton({ code }: { code: string }) {
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
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCopy}
        className="w-full rounded-lg bg-emerald-600 py-3 text-base font-medium text-white active:bg-emerald-700"
      >
        {status === "copied" ? "已复制 ✓" : "复制阵容码"}
      </button>
      {status === "fallback" && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500">无法自动复制，请长按下方选中复制：</p>
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
