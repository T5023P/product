"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, addDoc, onSnapshot, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { categoryPath } from "../../../lib/routeId";

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("name", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: { id: string; name: string }[] = [];
        snap.forEach((d) => next.push({ id: d.id, name: (d.data() as any).name }));
        setCategories(next);
        setErrorMessage("");
      },
      (err) => {
        console.error("Failed to load categories", err);
        setErrorMessage(err.message || "Failed to load categories.");
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "products"),
      (snap) => {
        const next: Record<string, number> = {};
        snap.forEach((d) => {
          const data = d.data() as { categories?: unknown };
          if (!Array.isArray(data.categories)) return;
          data.categories.forEach((categoryId) => {
            if (typeof categoryId === "string") {
              next[categoryId] = (next[categoryId] ?? 0) + 1;
            }
          });
        });
        setProductCounts(next);
      },
      (err) => {
        console.error("Failed to load category product counts", err);
      }
    );
    return () => unsub();
  }, []);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "categories"), { name: trimmedName, createdAt: new Date().toISOString() });
      setName("");
      setErrorMessage("");
    } catch (err) {
      console.error("Failed to create category", err);
      const message = err instanceof Error ? err.message : "Failed to create category.";
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this category? Products will retain their references.");
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, "categories", id));
      setErrorMessage("");
    } catch (err) {
      console.error("Failed to delete category", err);
      const message = err instanceof Error ? err.message : "Failed to delete category.";
      setErrorMessage(message);
    }
  };

  const handleCopy = async (id: string) => {
    const link =
      typeof window !== "undefined"
        ? `${window.location.origin}${categoryPath(id)}`
        : categoryPath(id);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? "" : current)), 1600);
    } catch (err) {
      console.error("Failed to copy category link", err);
      setErrorMessage("Failed to copy category link.");
    }
  };

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <main className="flex-1 px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-primary">Categories</h1>
        <p className="text-sm text-secondary-app mt-1">Create and manage catalog categories (used to group products).</p>
      </header>

      <section className="bg-white border border-outline-variant rounded-xl p-4 mb-6 space-y-4">
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category name" className="col-span-2 bg-white border border-outline-variant rounded-lg px-3 py-2" />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="bg-primary text-white rounded-lg px-4 py-2 disabled:bg-surface-container disabled:text-secondary-app disabled:cursor-not-allowed"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </form>

        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary-app text-[18px] pointer-events-none">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-surface-container-low border border-outline-variant rounded-full pl-10 pr-4 py-3 text-sm"
          />
        </div>
      </section>

      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200 mb-6">
          {errorMessage}
        </div>
      )}

      <div className="space-y-3">
        {filteredCategories.length === 0 ? (
          <div className="text-sm text-secondary-app">No categories yet.</div>
        ) : (
          <ul className="space-y-3">
            {filteredCategories.map((c) => (
              <li key={c.id} className="bg-white border border-outline-variant rounded-xl p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={categoryPath(c.id)} className="min-w-0 group">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[20px]">folder</span>
                      <span className="text-sm font-semibold text-primary group-hover:underline truncate">{c.name}</span>
                    </div>
                    <p className="text-xs text-secondary-app mt-1">
                      {productCounts[c.id] ?? 0} {(productCounts[c.id] ?? 0) === 1 ? "product" : "products"}
                    </p>
                  </Link>

                  <div className="flex items-center gap-2">
                    <Link href={categoryPath(c.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-outline-variant rounded-full px-3 py-2">
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      <span>Open</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleCopy(c.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary border border-outline-variant rounded-full px-3 py-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">{copiedId === c.id ? "check" : "content_copy"}</span>
                      <span>{copiedId === c.id ? "Copied" : "Copy"}</span>
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 border border-red-100 rounded-full px-3 py-2">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
