"use client";

import { useEffect, useState } from "react";
import type { Composition } from "@/lib/types";
import {
  loadLocal,
  saveLocal,
  isDirty,
  setDirty,
  createLocal,
  updateLocal,
  deleteLocal,
} from "@/lib/localStore";
import { CompositionCard } from "./CompositionCard";
import { CompositionForm, type CompositionFormValue } from "./CompositionForm";

type SyncStatus = "idle" | "syncing" | "synced" | "error";

export function CompositionsApp() {
  const [items, setItems] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirtyState] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Composition | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 初始加载：本地优先，本地为空时从云端拉一次种子
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const local = loadLocal();
      if (local !== null) {
        setItems(local);
        setDirtyState(isDirty());
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/compositions");
        const seeded: Composition[] = res.ok ? ((await res.json()).items ?? []) : [];
        if (cancelled) return;
        saveLocal(seeded);
        setItems(seeded);
      } catch {
        if (cancelled) return;
        saveLocal([]);
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // 写本地并标记未同步
  function persist(next: Composition[]) {
    setItems(next);
    saveLocal(next);
    setDirty(true);
    setDirtyState(true);
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(item: Composition) {
    setEditing(item);
    setShowForm(true);
  }

  function handleSubmit(value: CompositionFormValue) {
    setSubmitting(true);
    try {
      persist(editing ? updateLocal(items, editing.id, value) : createLocal(items, value));
      setShowForm(false);
      setEditing(null);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete(id: string) {
    persist(deleteLocal(items, id));
  }

  async function handleSync() {
    setSyncStatus("syncing");
    try {
      const res = await fetch("/api/compositions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        setSyncStatus("error");
        return;
      }
      setDirty(false);
      setDirtyState(false);
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 1500);
    } catch {
      setSyncStatus("error");
    }
  }

  const sorted = [...items].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const syncLabel =
    syncStatus === "syncing"
      ? "同步中…"
      : syncStatus === "synced"
        ? "已同步 ✓"
        : syncStatus === "error"
          ? "同步失败"
          : "同步";

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">金铲铲阵容码</h1>
        <div className="flex items-center gap-2">
          {dirty && syncStatus === "idle" && (
            <span className="text-xs text-amber-600">有未同步的修改</span>
          )}
          <button
            type="button"
            onClick={handleSync}
            disabled={syncStatus === "syncing"}
            className={`relative rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
              syncStatus === "error"
                ? "border-red-400 text-red-600"
                : "border-neutral-300 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-800"
            }`}
          >
            {syncLabel}
            {dirty && syncStatus === "idle" && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </header>

      {loading && <p className="text-center text-neutral-500">加载中…</p>}

      {!loading && items.length === 0 && (
        <p className="mt-16 text-center text-neutral-400">还没有阵容，点右下角 + 添加</p>
      )}

      <div className="space-y-3">
        {sorted.map((item) => (
          <CompositionCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />
        ))}
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={openCreate}
          aria-label="新增阵容"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-neutral-900 text-3xl leading-none text-white shadow-lg dark:bg-white dark:text-neutral-900"
        >
          +
        </button>
      )}

      {showForm && (
        <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 dark:bg-neutral-900 sm:rounded-2xl">
            <h2 className="mb-3 text-lg font-semibold">{editing ? "编辑阵容" : "新增阵容"}</h2>
            <CompositionForm
              initial={editing}
              submitting={submitting}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
