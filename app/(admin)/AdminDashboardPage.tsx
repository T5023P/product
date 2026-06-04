"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { editProductPath, productPath } from "../../lib/routeId";

interface Product {
  id: string;
  name: string;
  description: string;
  price?: number | null;
  imageUrls?: string[];
  categories?: string[];
  createdAt?: string;
  sortOrder?: number;
}

interface Category {
  id: string;
  name: string;
}

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [draftProducts, setDraftProducts] = useState<Product[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Live snapshot of products
  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next: Product[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<Product, "id">;
          next.push({ id: d.id, ...data });
        });
        next.sort((a, b) => {
          const aOrder = typeof a.sortOrder === "number" ? a.sortOrder : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.sortOrder === "number" ? b.sortOrder : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;

          const aCreated = Date.parse(a.createdAt ?? "");
          const bCreated = Date.parse(b.createdAt ?? "");
          if (Number.isNaN(aCreated) && Number.isNaN(bCreated)) return 0;
          if (Number.isNaN(aCreated)) return 1;
          if (Number.isNaN(bCreated)) return -1;
          return bCreated - aCreated;
        });
        setProducts(next);
        setDraftProducts(next);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe to products", err);
        setErrorMessage(err.message || "Failed to load products.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, "categories"), orderBy("name", "asc")),
      (snap) => {
        const next: Category[] = [];
        snap.forEach((d) => {
          const data = d.data() as { name?: unknown };
          if (typeof data.name === "string") {
            next.push({ id: d.id, name: data.name });
          }
        });
        setCategories(next);
      },
      (err) => {
        console.error("Failed to subscribe to categories", err);
        setErrorMessage(err.message || "Failed to load categories.");
      }
    );
    return () => unsubscribe();
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const source = rearrangeMode ? draftProducts : products;
    if (!q) return source;
    return source.filter((p) =>
      (p.name || "").toLowerCase().includes(q)
    );
  }, [draftProducts, products, rearrangeMode, search]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedProductIds.includes(product.id)),
    [products, selectedProductIds]
  );

  const allFilteredSelected =
    filtered.length > 0 &&
    filtered.every((product) => selectedProductIds.includes(product.id));

  const toggleProductSelection = (id: string) => {
    setSelectedProductIds((current) =>
      current.includes(id)
        ? current.filter((productId) => productId !== id)
        : [...current, id]
    );
  };

  const toggleFilteredSelection = () => {
    setSelectedProductIds((current) => {
      if (allFilteredSelected) {
        const filteredIds = new Set(filtered.map((product) => product.id));
        return current.filter((id) => !filteredIds.has(id));
      }

      const next = new Set(current);
      filtered.forEach((product) => next.add(product.id));
      return Array.from(next);
    });
  };

  const handleBulkAssignCategory = async () => {
    if (selectedProductIds.length === 0) return;

    const trimmedName = newCategoryName.trim();
    if (!selectedCategoryId && !trimmedName) {
      setErrorMessage("Choose a category or type a new category name.");
      return;
    }

    setBulkSaving(true);
    setErrorMessage("");

    try {
      let categoryId = selectedCategoryId;

      if (!categoryId) {
        const created = await addDoc(collection(db, "categories"), {
          name: trimmedName,
          createdAt: new Date().toISOString(),
        });
        categoryId = created.id;
      }

      await Promise.all(
        selectedProductIds.map((productId) =>
          updateDoc(doc(db, "products", productId), {
            categories: arrayUnion(categoryId),
          })
        )
      );

      setSelectedProductIds([]);
      setSelectedCategoryId("");
      setNewCategoryName("");
    } catch (err) {
      console.error("Failed to assign category", err);
      const message =
        err instanceof Error ? err.message : "Failed to assign category.";
      setErrorMessage(message);
    } finally {
      setBulkSaving(false);
    }
  };

  const handleCopy = async (id: string) => {
    try {
      const link = `${window.location.origin}${productPath(id)}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) {
          throw new Error("Clipboard copy failed");
        }
      }
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1500);
    } catch (err) {
      console.error("Copy link failed", err);
      setErrorMessage("Failed to copy link to clipboard.");
    }
  };

  const openWhatsApp = (id: string, name: string) => {
    const link = `${window.location.origin}${productPath(id)}`;
    const text = encodeURIComponent(`Check out ${name} from our catalog: ${link}`);
    const appDeepLink = `whatsapp://send?text=${text}`;
    const webLink = `https://wa.me/?text=${text}`;
    window.location.href = appDeepLink;
    window.setTimeout(() => {
      const opened = window.open(webLink, "_blank", "noopener,noreferrer");
      if (!opened) {
        window.location.href = webLink;
      }
    }, 450);
  };

  const moveDraftItem = (dragId: string, overId: string) => {
    if (dragId === overId) return;
    setDraftProducts((current) => {
      const from = current.findIndex((item) => item.id === dragId);
      const to = current.findIndex((item) => item.id === overId);
      if (from === -1 || to === -1) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const saveReorder = async () => {
    setReorderSaving(true);
    setErrorMessage("");
    try {
      await Promise.all(
        draftProducts.map((product, index) =>
          updateDoc(doc(db, "products", product.id), {
            sortOrder: index + 1,
          })
        )
      );
      setRearrangeMode(false);
    } catch (err) {
      console.error("Failed to save order", err);
      const message = err instanceof Error ? err.message : "Failed to save order.";
      setErrorMessage(message);
    } finally {
      setReorderSaving(false);
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || Number.isNaN(Number(price))) {
      return null;
    }
    const num = typeof price === "number" ? price : parseFloat(String(price));
    if (Number.isNaN(num)) return null;
    return `₹${num.toFixed(2)}`;
  };

  const padIndex = (n: number) => {
    if (filtered.length <= 99) return String(n).padStart(2, "0");
    return String(n);
  };

  return (
    <main className="flex-1 px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto w-full">
      {/* Big, prominent Add Product button */}
      <Link
        href="/catalog/new"
        className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-4 rounded-xl text-base transition-colors cursor-pointer shadow-sm shadow-primary/10 mb-4"
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
        <span>Add Product</span>
      </Link>

      {/* Search bar (mobile/tablet) */}
      <div className="relative w-full mb-6 md:hidden">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary-app text-[18px] pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-full text-sm w-full placeholder-secondary-app/60"
        />
      </div>

      <div className="hidden md:flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => {
            setRearrangeMode((value) => !value);
            setDraftProducts(products);
          }}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border ${
            rearrangeMode
              ? "bg-surface-container text-primary border-primary"
              : "bg-white text-primary border-outline-variant"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
          <span>{rearrangeMode ? "Exit Rearrange" : "Rearrange Mode"}</span>
        </button>
        {rearrangeMode && (
          <>
            <button
              type="button"
              onClick={saveReorder}
              disabled={reorderSaving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{reorderSaving ? "Saving..." : "Save Order"}</span>
            </button>
            <span className="text-xs text-secondary-app">Drag rows by handle and save.</span>
          </>
        )}
      </div>

      {products.length > 0 && (
        <section className="mb-6 bg-white border border-outline-variant rounded-xl p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleFilteredSelection}
                className="h-4 w-4 accent-primary"
              />
              <span>
                {selectedProductIds.length > 0
                  ? `${selectedProductIds.length} selected`
                  : "Select products"}
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex flex-1 gap-3">
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  if (e.target.value) setNewCategoryName("");
                }}
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm min-w-0"
              >
                <option value="">Choose existing category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <input
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  if (e.target.value.trim()) setSelectedCategoryId("");
                }}
                placeholder="Or create new category"
                className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm min-w-0"
              />
            </div>

            <button
              type="button"
              onClick={handleBulkAssignCategory}
              disabled={
                bulkSaving ||
                selectedProductIds.length === 0 ||
                (!selectedCategoryId && !newCategoryName.trim())
              }
              className="inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:bg-surface-container disabled:text-secondary-app disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">category</span>
              <span>{bulkSaving ? "Applying..." : "Put in Category"}</span>
            </button>
          </div>

          {selectedProducts.length > 0 && (
            <p className="text-xs text-secondary-app mt-3">
              Applies to: {selectedProducts.map((product) => product.name).join(", ")}
            </p>
          )}
        </section>
      )}

      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200 mb-6">
          {errorMessage}
        </div>
      )}

      {/* Products list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <section className="text-center py-16 bg-white border border-outline-variant rounded-2xl px-8 max-w-md mx-auto space-y-6">
          <span className="material-symbols-outlined text-[64px] text-secondary-app/60">
            inventory_2
          </span>
          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-primary">
              No products yet
            </h3>
            <p className="text-sm text-secondary-app">
              Start your catalog by adding your first product.
            </p>
          </div>
          <Link
            href="/catalog/new"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              add
            </span>
            <span>Add your first product</span>
          </Link>
        </section>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-secondary-app">
          No products match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className="flex flex-col border-t border-outline-variant">
          {filtered.map((product, idx) => {
            const thumb = product.imageUrls?.[0];
            const priceLabel = formatPrice(product.price);
            const wasCopied = copiedId === product.id;

            return (
              <div
                key={product.id}
                draggable={rearrangeMode}
                onDragStart={() => setDraggingId(product.id)}
                onDragOver={(e) => {
                  if (!rearrangeMode) return;
                  e.preventDefault();
                  if (draggingId) moveDraftItem(draggingId, product.id);
                }}
                onDragEnd={() => setDraggingId(null)}
                className="group flex items-center gap-4 md:gap-6 py-4 md:py-5 px-3 md:px-4 -mx-3 md:-mx-4 rounded-lg border-b border-surface-container transition-colors hover:bg-surface-container-low"
              >
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    disabled={!rearrangeMode}
                    className={`hidden md:inline-flex items-center justify-center p-1 rounded ${
                      rearrangeMode ? "text-primary cursor-grab" : "text-secondary-app/30"
                    }`}
                    aria-label="Drag to reorder"
                    title="Drag to reorder"
                  >
                    <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
                  </button>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(product.id)}
                    onChange={() => toggleProductSelection(product.id)}
                    aria-label={`Select ${product.name}`}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="font-mono text-xs uppercase tracking-wider text-secondary-app w-7 text-right">
                    {padIndex(idx + 1)}
                  </span>
                </div>

                <div className="relative w-16 h-20 rounded overflow-hidden bg-surface-container shrink-0">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={product.name}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary-app/60 text-[20px]">
                        image
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-display text-base md:text-lg font-semibold text-primary leading-tight">
                      {product.name}
                    </h3>
                    <span className="text-sm text-secondary-app">
                      {priceLabel ?? (
                        <span className="uppercase tracking-wider text-[10px] font-semibold bg-surface-container px-2 py-0.5 rounded">
                          Inquire
                        </span>
                      )}
                    </span>
                  </div>
                  {product.description ? (
                    <p className="text-xs md:text-sm text-secondary-app mt-1 line-clamp-2">
                      {product.description}
                    </p>
                  ) : null}
                  {Array.isArray(product.categories) && product.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {product.categories.map((categoryId) => {
                        const category = categories.find((item) => item.id === categoryId);
                        return (
                          <span
                            key={categoryId}
                            className="text-[10px] font-semibold uppercase tracking-wider bg-surface-container px-2 py-0.5 rounded"
                          >
                            {category?.name ?? "Category"}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
  <Link
    href={editProductPath(product.id)}
    aria-label={`Edit ${product.name}`}
    className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full border border-outline-variant text-primary hover:bg-surface-container-high text-xs font-semibold transition-colors cursor-pointer"
  >
    <span className="material-symbols-outlined text-[16px]">edit</span>
    <span className="hidden sm:inline">Edit</span>
  </Link>

  <button
    type="button"
    onClick={() => handleCopy(product.id)}
    aria-label={`Copy link for ${product.name}`}
    className={`inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${wasCopied ? "border-emerald-600 text-emerald-700 bg-emerald-50" : "border-outline-variant text-primary hover:bg-surface-container-high"}`}
  >
    <span className="material-symbols-outlined text-[16px]">{wasCopied ? "check" : "link"}</span>
    <span className="hidden sm:inline">{wasCopied ? "Copied!" : "Copy"}</span>
  </button>

  <button
    type="button"
    onClick={() => openWhatsApp(product.id, product.name)}
    aria-label={`Share ${product.name} on WhatsApp`}
    className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full border border-outline-variant text-primary hover:bg-surface-container-high text-xs font-semibold transition-colors cursor-pointer"
  >
    <span className="material-symbols-outlined text-[16px]">chat</span>
    <span className="hidden sm:inline">WhatsApp</span>
  </button>

  <a
    href={productPath(product.id)}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full border border-outline-variant text-primary hover:bg-surface-container-high text-xs font-semibold transition-colors cursor-pointer"
  >
    <span className="material-symbols-outlined text-[16px]">open_in_browser</span>
    <span className="hidden sm:inline">Browser</span>
  </a>
</div>
              </div>
            );
          })}
        </div>
      )}
      </main>
    );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto w-full">
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </main>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
