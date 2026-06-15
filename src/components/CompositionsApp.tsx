"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Composition } from "@/lib/compositions";
import { CompositionCard } from "./CompositionCard";
import { CompositionForm, type CompositionFormValue } from "./CompositionForm";

export function CompositionsApp() {
  const router = useRouter();
  const [items, setItems] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Composition | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/compositions");
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const json = await res.json();
      setItems(json.items ?? []);
    } catch {
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(item: Composition) {
    setEditing(item);
    setShowForm(true);
  }

  async function handleSubmit(value: CompositionFormValue) {
    setSubmitting(true);
    try {
      const url = editing ? `/api/compositions/${editing.id}` : "/api/compositions";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setError("保存失败");
        return;
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/compositions/${id}`, { method: "DELETE" });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">金铲铲阵容码</h1>
      </header>

      {loading && <p className="text-center text-neutral-500">加载中…</p>}
      {error && <p className="text-center text-red-600">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="mt-16 text-center text-neutral-400">还没有阵容，点右下角 + 添加</p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <CompositionCard
            key={item.id}
            item={item}
            onEdit={openEdit}
            onDelete={handleDelete}
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
            <h2 className="mb-3 text-lg font-semibold">
              {editing ? "编辑阵容" : "新增阵容"}
            </h2>
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
