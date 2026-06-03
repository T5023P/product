"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { resolveRouteId } from "../../../lib/routeId";

interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number | null;
  imageUrls?: string[];
}

export default function CategoryPage() {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const id = useMemo(
    () => resolveRouteId("category", params?.id, pathname),
    [params?.id, pathname]
  );
  const [categoryName, setCategoryName] = useState("Category");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!id) return;

    getDoc(doc(db, "categories", id))
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { name?: unknown };
        if (typeof data.name === "string") setCategoryName(data.name);
      })
      .catch((err) => {
        console.error("Failed to load category", err);
        setErrorMessage(err.message || "Failed to load category.");
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(
      query(collection(db, "products"), where("categories", "array-contains", id)),
      (snap) => {
        const next: Product[] = [];
        snap.forEach((d) => next.push({ id: d.id, ...(d.data() as Omit<Product, "id">) }));
        setProducts(next);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load category products", err);
        setErrorMessage(err.message || "Failed to load products.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [id]);

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [products]
  );

  const handleCopyCategory = async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.error("Failed to copy category link", err);
      setErrorMessage("Failed to copy category link.");
    }
  };

  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || Number.isNaN(Number(price))) return null;
    return `₹${Number(price).toFixed(2)}`;
  };

  return (
    <div className="bg-background-app text-on-background min-h-screen">
      <header className="bg-white border-b border-surface-container-highest sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-lg font-bold tracking-widest text-primary uppercase">
            Catalog
          </Link>
          <button
            type="button"
            onClick={handleCopyCategory}
            className="inline-flex items-center gap-1.5 border border-outline-variant rounded-full px-3 py-2 text-xs font-semibold text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
            <span>{copied ? "Copied" : "Copy Category"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary-app">Category</p>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-primary mt-1">{categoryName}</h1>
          <p className="text-sm text-secondary-app mt-2">
            {sortedProducts.length} {sortedProducts.length === 1 ? "product" : "products"}
          </p>
        </section>

        {errorMessage && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200 mb-6">
            {errorMessage}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="bg-white border border-outline-variant rounded-xl p-8 text-center text-sm text-secondary-app">
            No products in this category yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedProducts.map((product) => {
              const thumb = product.imageUrls?.[0];
              return (
                <Link
                  key={product.id}
                  href={`/p/${product.id}`}
                  className="bg-white border border-outline-variant rounded-xl overflow-hidden hover:border-primary transition-colors"
                >
                  <div className="relative aspect-[4/5] bg-surface-container">
                    {thumb ? (
                      <img src={thumb} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-secondary-app text-[32px]">image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-display text-base font-semibold text-primary line-clamp-2">{product.name}</h2>
                    {formatPrice(product.price) ? (
                      <p className="text-sm text-secondary-app mt-1">{formatPrice(product.price)}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
