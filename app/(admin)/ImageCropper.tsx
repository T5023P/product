"use client";

import React, { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";

interface ImageCropperProps {
  file: File;
  onCrop: (blob: Blob, fileName: string) => void;
  onCancel: () => void;
}

const ASPECT_OPTIONS: { label: string; value: number }[] = [
  { label: "Square", value: 1 },
  { label: "Portrait", value: 4 / 5 },
  { label: "Photo", value: 3 / 4 },
  { label: "Wide", value: 16 / 9 },
];

/**
 * Draws the selected region of the full-resolution source image onto a canvas
 * and encodes it as a JPEG blob. `area` is the pixel rect reported by
 * react-easy-crop via `onCropComplete` (in source-image coordinates).
 */
async function getCroppedBlob(
  src: string,
  area: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height
  );

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Crop failed"))),
      "image/jpeg",
      0.92
    );
  });
}

export default function ImageCropper({
  file,
  onCrop,
  onCancel,
}: ImageCropperProps) {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [aspect, setAspect] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Create an object URL from the file and revoke it on unmount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleCropComplete = useCallback(
    (_croppedArea: Area, areaPixels: Area) => {
      setCroppedAreaPixels(areaPixels);
    },
    []
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!croppedAreaPixels) {
        // Shouldn't happen after first render — fall back to the original file.
        onCrop(file, file.name);
        return;
      }
      const blob = await getCroppedBlob(imageUrl, croppedAreaPixels);
      onCrop(blob, file.name);
    } catch (error) {
      console.error("Crop failed", error);
      alert("Unable to crop the image. Please try again.");
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-surface-container-strong max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-surface-container">
          <div>
            <h2 className="text-lg font-semibold text-primary">Crop Photo</h2>
            <p className="text-sm text-secondary-app">
              Drag to reposition · pinch or scroll to zoom
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-secondary-app hover:text-primary p-2 rounded-full transition-colors"
            aria-label="Cancel cropping"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-3 sm:p-4 space-y-4 overflow-y-auto">
          {/* Aspect ratio buttons */}
          <div className="flex flex-wrap gap-2">
            {ASPECT_OPTIONS.map((option) => {
              const active = aspect === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setAspect(option.value)}
                  aria-pressed={active}
                  className={
                    active
                      ? "px-4 py-2 rounded-full text-sm font-semibold bg-primary text-white transition-colors"
                      : "px-4 py-2 rounded-full text-sm font-semibold bg-white border border-outline-variant text-primary hover:bg-surface-container transition-colors"
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* Crop stage */}
          <div className="relative w-full h-[60vh] max-h-[520px] bg-surface-container-low rounded-2xl sm:rounded-3xl overflow-hidden">
            {imageUrl && (
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                showGrid={true}
                zoomWithScroll={true}
                minZoom={1}
                maxZoom={5}
                restrictPosition={true}
              />
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white pt-2 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-outline-variant text-secondary-app hover:text-primary bg-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                "Crop & Save"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
