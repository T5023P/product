"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function ProductActions({ productId }: { productId: string }) {
  const router = useRouter();

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      alert("Product link copied to clipboard!");
    } catch (e) {
      alert("Failed to copy link.");
    }
  };

  const handleEdit = () => {
    router.push(`/admin/edit/${productId}`);
  };

  const handleWhatsApp = () => {
    const phone = "<YOUR_PHONE_NUMBER>"; // replace with actual number or config
    const encodedUrl = encodeURIComponent(currentUrl);
    const waLink = `https://wa.me/${phone}?text=Check%20out%20this%20product%20${encodedUrl}`;
    window.open(waLink, "_blank");
  };

  const handleOpenInBrowser = () => {
    window.open(currentUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-wrap gap-3 mt-4">
      <button
        onClick={handleCopyLink}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition"
      >
        Copy Link
      </button>
      <button
        onClick={handleEdit}
        className="px-4 py-2 bg-secondary text-white rounded hover:bg-secondary-dark transition"
      >
        Edit
      </button>
      <button
        onClick={handleWhatsApp}
        className="px-4 py-2 bg-success text-white rounded hover:bg-success-dark transition"
      >
        WhatsApp
      </button>
      <button
        onClick={handleOpenInBrowser}
        className="px-4 py-2 bg-white text-primary border border-outline-variant rounded hover:bg-surface-container-low transition"
      >
        Open in Browser
      </button>
    </div>
  );
}
