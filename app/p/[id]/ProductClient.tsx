"use client";

import React, { useEffect, useState } from "react";
import ProductActions from "./ProductActions";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import ProductGallery from "./ProductGallery";

interface ProductData {
  name: string;
  description: string;
  price?: number | string | null;
  imageUrls?: string[];
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (cancelled) return;
        if (snap.exists()) {
          setProduct(snap.data() as ProductData);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching product:", err);
        setError(err instanceof Error ? err.message : "Failed to load product.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  // Update document title when product loads
  useEffect(() => {
    if (product?.name) {
      document.title = `${product.name} | Catalog`;
    }
  }, [product?.name]);

  if (loading) {
    return (
      <div className="bg-background-app min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background-app flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md bg-white border border-outline-variant rounded-xl p-8 shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-red-400 mb-4">error</span>
          <h1 className="font-display text-2xl font-bold text-primary tracking-tight">Something went wrong</h1>
          <p className="text-sm text-secondary-app mt-2">{error}</p>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="min-h-screen bg-background-app flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md bg-white border border-outline-variant rounded-xl p-8 shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-secondary-app mb-4">
            sentiment_dissatisfied
          </span>
          <h1 className="font-display text-2xl font-bold text-primary tracking-tight">Product Not Found</h1>
          <p className="text-sm text-secondary-app mt-2">
            The link is invalid or the item has been removed from the catalog.
          </p>
        </div>
      </main>
    );
  }

  const whatsappMessage = `Hi, I'm interested in ${product.name} from your catalog!`;
  const whatsappUrl = `https://wa.me/919415577215?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="bg-background-app text-on-background min-h-screen selection:bg-surface-container selection:text-primary">
      {/* Top Header */}
      <header className="bg-white border-b border-surface-container-highest sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-3xl md:max-w-4xl mx-auto h-16 px-6 flex items-center justify-between">
          <span className="font-display text-lg font-bold tracking-widest text-primary uppercase">
            Catalog
          </span>
          <span className="text-[10px] uppercase font-semibold tracking-wider text-secondary-app bg-surface-container px-2.5 py-1 rounded">
            Public View
          </span>
        </div>
      </header>

      {/* Main Container (Link-in-bio constrained look) */}
      <main className="max-w-3xl md:max-w-4xl mx-auto bg-white min-h-[calc(100vh-64px)] pb-28 shadow-[0_0_40px_rgba(0,0,0,0.015)] relative">
        <div className="p-6 md:p-8 space-y-8">
          
          {/* Image Gallery */}
          <section>
            <ProductGallery imageUrls={product.imageUrls || []} name={product.name} />
          </section>
          <ProductActions productId={id} />

          {/* Title and Price */}
          <section className="border-b border-surface-container-highest pb-4">
            <div className="flex justify-between items-start gap-4">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-primary tracking-tight leading-tight">
                {product.name}
              </h1>
              {product.price && (
                <span className="font-display text-xl md:text-2xl font-bold text-primary whitespace-nowrap">
                  ₹{parseFloat(String(product.price)).toFixed(2)}
                </span>
              )}
            </div>
          </section>

          {/* Description */}
          <section className="space-y-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-secondary-app">
              Description &amp; Details
            </h3>
            <p className="text-sm md:text-base text-on-surface-variant leading-relaxed font-sans whitespace-pre-wrap">
              {product.description}
            </p>
          </section>

        </div>

        {/* Floating bottom action bar */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-3xl md:max-w-4xl px-6 py-4 bg-white/90 backdrop-blur-md border-t border-surface-container-highest z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] flex justify-center">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold text-sm uppercase tracking-widest py-4 px-6 rounded-lg flex justify-center items-center gap-2 transition-all active:scale-[0.98] cursor-pointer shadow-md shadow-primary/10 touch-manipulation min-h-[52px]"
          >
            <span className="material-symbols-outlined text-[18px]">chat</span>
            <span>Contact on WhatsApp</span>
          </a>
        </div>
      </main>
    </div>
  );
}
