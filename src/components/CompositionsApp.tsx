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
  togglePin,
} from "@/lib/localStore";
import { CompositionCard } from "./CompositionCard";
import { CompositionForm, type CompositionFormValue } from "./CompositionForm";

type SyncStatus = "idle" | "syncing" | "synced" | "error";

export function CompositionsApp() {
  const [items, setItems] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedError, setSeedError] = useState(false);
  const [dirty, setDirtyState] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Composition | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  // 每次加载：先用本地缓存秒开，再从云端拉取覆盖（远端为准）
  useEffect(() => {
    let cancelled = false;
    const local = loadLocal();
    if (local !== null) {
      setItems(local);
      setDirtyState(isDirty());
      setLoading(false);
    }
    async function refresh() {
      try {
        const res = await fetch("/api/compositions");
        if (!res.ok) throw new Error("load failed");
        const cloud: Composition[] = (await res.json()).items ?? [];
        if (cancelled) return;
        saveLocal(cloud);
        setItems(cloud);
        setDirty(false);
        setDirtyState(false);
        setSeedError(false);
      } catch {
        if (cancelled) return;
        // 云端拉取失败：有本地缓存就继续用本地（离线兜底）；没有则标记错误
        if (local === null) {
          setSeedError(true);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    refresh();
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

  function handleTogglePin(id: string) {
    persist(togglePin(items, id));
  }

  async function handleSync() {
    setSyncStatus("syncing");
    const snapshot = items; // 同步时刻的快照
    try {
      const res = await fetch("/api/compositions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: snapshot }),
      });
      if (!res.ok) {
        setSyncStatus("error");
        return;
      }
      // 仅当同步期间没有新的本地改动（引用未变）时才清除 dirty
      setItems((current) => {
        if (current === snapshot) {
          setDirty(false);
          setDirtyState(false);
        }
        return current;
      });
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 1500);
    } catch {
      setSyncStatus("error");
    }
  }

  const q = query.trim().toLowerCase();
  const matched = q
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.note ?? "").toLowerCase().includes(q),
      )
    : items;
  // 置顶区按置顶时间倒序（最新置顶在前）；普通区按 updated_at 倒序。
  const pinned = matched
    .filter((item) => item.pinned_at)
    .sort((a, b) => (a.pinned_at! < b.pinned_at! ? 1 : -1));
  const rest = matched
    .filter((item) => !item.pinned_at)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const total = pinned.length + rest.length;
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
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-neutral-200 bg-white/90 px-4 pb-3 pt-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <header className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold">金铲铲阵容码</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={syncStatus === "syncing" || seedError}
              className={`relative rounded-lg border px-2.5 py-1.5 text-sm font-medium disabled:opacity-50 ${
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
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden>
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索阵容名 / 备注…"
            aria-label="搜索阵容"
            className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-9 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清除搜索"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-neutral-400 active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-center text-neutral-500">加载中…</p>}

      {seedError && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600 dark:bg-red-950">
          云端数据加载失败，请刷新页面重试
        </p>
      )}

      {!loading && !seedError && items.length === 0 && (
        <p className="mt-16 text-center text-neutral-400">还没有阵容，点右下角 + 添加</p>
      )}

      {!loading && !seedError && items.length > 0 && total === 0 && (
        <p className="mt-16 text-center text-neutral-400">没有匹配「{query}」的阵容</p>
      )}

      {pinned.length > 0 && (
        <section className="mb-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-400">
            <span>📌 置顶</span>
            <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {pinned.map((item) => (
              <CompositionCard
                key={item.id}
                item={item}
                onEdit={openEdit}
                onDelete={handleDelete}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        {rest.map((item) => (
          <CompositionCard
            key={item.id}
            item={item}
            onEdit={openEdit}
            onDelete={handleDelete}
            onTogglePin={handleTogglePin}
          />
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
