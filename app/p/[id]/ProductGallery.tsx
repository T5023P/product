"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface ProductGalleryProps {
  imageUrls: string[];
  name: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function ProductGallery({
  imageUrls,
  name,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Track which URLs the browser has already decoded so the spinner is tied
  // to the URL (never the index) — this guarantees we never show a stale
  // "loading" state for an image that is already warm in cache.
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());

  const markLoaded = useCallback((url: string) => {
    setLoadedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  // Preload every image on mount. The uploads are already compressed
  // (<=1600px, <500KB) so warming all of them is cheap and makes switching
  // instant — the browser serves cached bytes the moment we change `src`.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!imageUrls || imageUrls.length === 0) return;

    imageUrls.forEach((url) => {
      const img = new window.Image();
      img.decoding = "async";
      img.onload = () => markLoaded(url);
      img.src = url;
      // Cached images may already be complete synchronously.
      if (img.complete && img.naturalWidth > 0) {
        markLoaded(url);
      }
    });
  }, [imageUrls, markLoaded]);

  const goTo = useCallback(
    (next: number) => {
      if (!imageUrls || imageUrls.length === 0) return;
      const total = imageUrls.length;
      const wrapped = ((next % total) + total) % total;
      // Switch immediately — no waiting on any in-flight request.
      setActiveIndex(wrapped);
    },
    [imageUrls]
  );

  if (!imageUrls || imageUrls.length === 0) {
    return (
      <div className="w-full aspect-[4/3] bg-surface-container rounded-xl flex items-center justify-center">
        <span className="material-symbols-outlined text-secondary-app text-4xl">
          image
        </span>
      </div>
    );
  }

  const total = imageUrls.length;
  const activeUrl = imageUrls[activeIndex];
  const showSpinner = !loadedUrls.has(activeUrl);

  return (
    <div className="space-y-4">
      {/* Main image — flexible height, shows the FULL image without cropping. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Open fullscreen"
        onClick={() => setLightboxOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setLightboxOpen(true);
          }
        }}
        className="relative w-full min-h-[55vh] md:min-h-[65vh] max-h-[80vh] bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden flex items-center justify-center cursor-zoom-in select-none"
      >
        {showSpinner && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            aria-hidden="true"
          >
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeUrl}
          alt={`${name} - View ${activeIndex + 1}`}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          onLoad={() => markLoaded(activeUrl)}
          className="w-full h-full max-h-[80vh] object-contain transition-opacity duration-200"
          style={{ opacity: showSpinner ? 0.4 : 1 }}
        />
      </div>

      {/* Thumbnails */}
      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          {imageUrls.map((url, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-current={isActive ? "true" : undefined}
                aria-label={`Show image ${index + 1} of ${total}`}
                className={`relative w-20 h-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                  isActive
                    ? "border-primary scale-[1.02]"
                    : "border-transparent opacity-75 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${name} thumbnail ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover object-center"
                />
              </button>
            );
          })}
        </div>
      )}

      {lightboxOpen && (
        <Lightbox
          imageUrls={imageUrls}
          activeIndex={activeIndex}
          name={name}
          onClose={() => setLightboxOpen(false)}
          onNavigate={goTo}
        />
      )}
    </div>
  );
}

interface LightboxProps {
  imageUrls: string[];
  activeIndex: number;
  name: string;
  onClose: () => void;
  onNavigate: (next: number) => void;
}

function Lightbox({
  imageUrls,
  activeIndex,
  name,
  onClose,
  onNavigate,
}: LightboxProps) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Pointer / pinch state stored in refs so handlers don't re-bind every move.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const total = imageUrls.length;

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
    pointersRef.current.clear();
    lastPinchDistRef.current = null;
    lastPanRef.current = null;
  }, []);

  // Reset zoom + pan whenever the active image changes or the lightbox opens.
  useEffect(() => {
    reset();
  }, [activeIndex, reset]);

  // Body scroll lock + keyboard navigation while open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" && total > 1) {
        e.preventDefault();
        onNavigate(activeIndex + 1);
      } else if (e.key === "ArrowLeft" && total > 1) {
        e.preventDefault();
        onNavigate(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previous;
    };
  }, [activeIndex, total, onClose, onNavigate]);

  // Wheel zoom needs a non-passive listener so we can preventDefault.
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY;
      const factor = delta > 0 ? 1.1 : 1 / 1.1;
      setScale((current) => {
        const next = clamp(current * factor, MIN_SCALE, MAX_SCALE);
        if (next === MIN_SCALE) {
          // Snap pan back to center when fully zoomed out.
          setTx(0);
          setTy(0);
        }
        return next;
      });
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
    };
  }, []);

  const distance = (
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number => Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      lastPinchDistRef.current = distance(a, b);
      lastPanRef.current = null;
    } else if (pointersRef.current.size === 1 && scale > 1) {
      lastPanRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = distance(a, b);
      const last = lastPinchDistRef.current;
      if (last && last > 0) {
        const ratio = dist / last;
        setScale((current) => {
          const next = clamp(current * ratio, MIN_SCALE, MAX_SCALE);
          if (next === MIN_SCALE) {
            setTx(0);
            setTy(0);
          }
          return next;
        });
      }
      lastPinchDistRef.current = dist;
      return;
    }

    if (
      pointersRef.current.size === 1 &&
      scale > 1 &&
      lastPanRef.current
    ) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      setTx((prev) => prev + dx);
      setTy((prev) => prev + dy);
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      lastPinchDistRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      lastPanRef.current = null;
    }
  };

  const onDoubleClick = () => {
    setScale((current) => {
      const next = current > 1 ? 1 : DOUBLE_TAP_SCALE;
      if (next === 1) {
        setTx(0);
        setTy(0);
      }
      return next;
    });
  };

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(activeIndex - 1);
  };
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(activeIndex + 1);
  };
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} fullscreen viewer`}
      className="fixed inset-0 z-50 bg-black/95 select-none"
      onClick={onClose}
    >
      {/* Counter */}
      <div className="absolute top-3 left-4 text-white/80 text-sm font-mono tracking-wider z-10 pointer-events-none">
        {activeIndex + 1} / {total}
      </div>

      {/* Close button */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close fullscreen"
        className="absolute top-2 right-2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
      >
        <span className="material-symbols-outlined text-[24px]">close</span>
      </button>

      {/* Prev / Next */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[28px]">
              chevron_left
            </span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[28px]">
              chevron_right
            </span>
          </button>
        </>
      )}

      {/* Stage */}
      <div
        ref={stageRef}
        onClick={stop}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={onDoubleClick}
        className="absolute inset-0 flex items-center justify-center overflow-hidden touch-none"
        style={{
          cursor: scale > 1 ? "grab" : "zoom-in",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrls[activeIndex]}
          alt={`${name} - Fullscreen view ${activeIndex + 1}`}
          loading="eager"
          decoding="async"
          draggable={false}
          className="max-w-full max-h-full object-contain pointer-events-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "center center",
            transition:
              pointersRef.current.size === 0 ? "transform 120ms ease-out" : "none",
          }}
        />
      </div>
    </div>
  );
}
