"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { editProductPath } from "../../../lib/routeId";

export default function ProductActions({ productId }: { productId: string }) {
  const router = useRouter();

  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
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
  };

  const handleCopyLink = async () => {
    try {
      await copyToClipboard(currentUrl);
      alert("Product link copied to clipboard!");
    } catch {
      alert("Failed to copy link.");
    }
  };

  const handleEdit = () => {
    router.push(editProductPath(productId));
  };

  const handleWhatsApp = () => {
    const phone = "<YOUR_PHONE_NUMBER>"; // replace with actual number or config
    const encodedUrl = encodeURIComponent(currentUrl);
    const waLink = `https://wa.me/${phone}?text=Check%20out%20this%20product%20${encodedUrl}`;
    window.open(waLink, "_blank", "noopener,noreferrer");
  };

  const handleOpenInBrowser = () => {
    const opened = window.open(currentUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      window.location.href = currentUrl;
    }
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
