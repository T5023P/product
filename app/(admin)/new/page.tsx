"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, onSnapshot } from "firebase/firestore";
import { db, storage } from "../../../lib/firebase";
import { compressImage } from "../../../lib/compressImage";
import ImageCropper from "../ImageCropper";

interface UploadedFile {
  id: string;
  name: string;
  progress: number;
  url?: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdId, setCreatedId] = useState("");
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    if (formRef.current) formRef.current.reset();
    setUploads([]);
    setSelectedCategories([]);
  };

  // load categories for assignment
  React.useEffect(() => {
    const q = collection(db, "categories");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: { id: string; name: string }[] = [];
        snap.forEach((d) => next.push({ id: d.id, name: (d.data() as any).name }));
        setCategories(next);
        setCategoryError("");
      },
      (err) => {
        console.error("Failed to load categories", err);
        setCategoryError(err.message || "Failed to load categories.");
      }
    );
    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setSubmitError("");

    try {
      const name =
        (e.currentTarget.elements.namedItem("name") as HTMLInputElement | null)
          ?.value ?? "";
      const description =
        (
          e.currentTarget.elements.namedItem(
            "description"
          ) as HTMLTextAreaElement | null
        )?.value ?? "";
      const priceInput =
        (
          e.currentTarget.elements.namedItem(
            "price"
          ) as HTMLInputElement | null
        )?.value ?? "";

      if (!name || !description) {
        setSubmitError("Product Name and Description are required.");
        setIsPending(false);
        return;
      }

      const price = priceInput ? parseFloat(priceInput) : null;
      const urls = uploads
        .filter((u) => u.url)
        .map((u) => u.url as string);

      const docRef = await addDoc(collection(db, "products"), {
        name,
        description,
        price: price || null,
        imageUrls: urls,
        categories: selectedCategories,
        sortOrder: Date.now(),
        createdAt: new Date().toISOString(),
      });

      setCreatedId(docRef.id);
      setShowSuccessModal(true);
      resetForm();
    } catch (err: unknown) {
      console.error("Error saving product: ", err);
      const message =
        err instanceof Error ? err.message : "Failed to save product.";
      setSubmitError(message);
    } finally {
      setIsPending(false);
    }
  };

  const uploadFile = async (file: File) => {
    const uploadId = Math.random().toString(36).substring(2, 9);
    const newUpload: UploadedFile = {
      id: uploadId,
      name: file.name,
      progress: 0,
    };

    setUploads((prev) => [...prev, newUpload]);

    let payload: Blob = file;
    try {
      payload = await compressImage(file);
    } catch (err) {
      console.error(
        "compressImage failed, uploading original:",
        file.name,
        err
      );
      payload = file;
    }

    const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, payload);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, progress } : u
          )
        );
      },
      (error) => {
        console.error("Upload error for file:", file.name, error);
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        alert(`Failed to upload ${file.name}`);
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId ? { ...u, url, progress: 100 } : u
          )
        );
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const isCamera = e.target === cameraInputRef.current;

    if (isCamera && files.length === 1) {
      setPendingCropFile(files[0]);
      return;
    }

    files.forEach((file) => uploadFile(file));

    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const cancelCrop = () => {
    setPendingCropFile(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleCropComplete = async (blob: Blob, fileName: string) => {
    setPendingCropFile(null);
    const croppedFile = new File([blob], fileName, { type: blob.type });
    await uploadFile(croppedFile);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const getShareLink = () =>
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${createdId}`
      : `/p/${createdId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const isUploading = uploads.some((u) => u.progress < 100);
  const completedUploads = uploads.filter((u) => u.url);

  return (
    <main className="flex-1 px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto w-full">
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/catalog")}
        className="inline-flex items-center gap-1.5 text-secondary-app hover:text-primary text-sm font-medium mb-6 cursor-pointer transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">
          arrow_back
        </span>
        <span>Back</span>
      </button>

      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">
          Add Product
        </h1>
        <p className="text-secondary-app mt-2 text-sm md:text-base">
          Upload images and define specs for the new piece.
        </p>
      </header>

      {pendingCropFile && (
        <ImageCropper
          file={pendingCropFile}
          onCrop={handleCropComplete}
          onCancel={cancelCrop}
        />
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8"
      >
        {/* Left: file upload */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-secondary-app mb-3">
              Product Images
            </label>

            <div className="bg-surface-container-low border border-dashed border-outline-variant rounded-xl p-6 text-center">
              <span className="material-symbols-outlined text-secondary-app text-4xl mb-2 block">
                add_photo_alternate
              </span>
              <p className="text-xs text-secondary-app mb-4">
                Add product photos — choose from your gallery or snap a new one.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  aria-label="Upload images from gallery"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer text-sm touch-manipulation"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    photo_library
                  </span>
                  <span>Upload from Gallery</span>
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  aria-label="Take a photo with the camera"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-white hover:bg-surface-container border border-outline-variant hover:border-primary text-primary font-semibold py-3 px-4 rounded-lg transition-colors cursor-pointer text-sm touch-manipulation"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    photo_camera
                  </span>
                  <span>Take Photo</span>
                </button>
              </div>
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {uploads.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary-app">
                Upload Status
              </h3>
              <div className="bg-white border border-outline-variant rounded-xl p-4 space-y-4">
                {uploads.map((upload) => (
                  <div
                    key={upload.id}
                    className="flex gap-4 items-center border-b border-surface-container-low last:border-0 pb-3 last:pb-0"
                  >
                    <div className="w-12 h-15 bg-surface-container rounded overflow-hidden flex-shrink-0 relative">
                      {upload.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={upload.url}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px] text-secondary-app animate-pulse">
                            image
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-primary truncate font-medium">
                        {upload.name}
                      </p>
                      {upload.progress < 100 ? (
                        <div className="mt-2">
                          <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-300"
                              style={{ width: `${upload.progress}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-secondary-app mt-1">
                            {upload.progress}% uploading
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">
                            check_circle
                          </span>{" "}
                          Ready
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeUpload(upload.id)}
                      className="text-secondary-app hover:text-red-600 p-1 cursor-pointer"
                      aria-label={`Remove ${upload.name}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        close
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right: inputs */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white border border-outline-variant rounded-xl p-6 md:p-8 space-y-6">
            <h2 className="font-display text-xl font-bold text-primary">
              Details
            </h2>

            <div className="space-y-6">
              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider text-secondary-app mb-2"
                  htmlFor="name"
                >
                  Product Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Minimalist Ceramic Vase"
                  className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 px-0 py-2.5 text-base text-on-surface transition-colors placeholder-secondary-app/40"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider text-secondary-app mb-2"
                    htmlFor="price"
                  >
                    Price (Optional)
                  </label>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 px-0 py-2.5 text-base text-on-surface transition-colors placeholder-secondary-app/40"
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider text-secondary-app mb-2"
                  htmlFor="description"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={5}
                  placeholder="Describe the item craftsmanship, background, dimensions..."
                  className="w-full bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-4 text-sm text-on-surface resize-none placeholder-secondary-app/40"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-secondary-app mb-2">
                  Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const checked = selectedCategories.includes(c.id);
                    return (
                      <label key={c.id} className="inline-flex items-center gap-2 bg-surface-container px-3 py-1 rounded-full text-sm cursor-pointer">
                        <input type="checkbox" value={c.id} checked={checked} onChange={(e) => {
                          const v = e.target.value;
                          setSelectedCategories((prev) => e.target.checked ? [...prev, v] : prev.filter(x => x !== v));
                        }} />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
                {categoryError && (
                  <p className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 mt-3">
                    {categoryError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {submitError && (
            <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
              {submitError}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={
                isPending || isUploading || completedUploads.length === 0
              }
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation text-base cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Product...</span>
                </>
              ) : isUploading ? (
                <span>
                  Uploading Images (
                  {uploads.filter((u) => u.progress < 100).length} left)...
                </span>
              ) : completedUploads.length === 0 ? (
                <span>Select at least 1 image to save</span>
              ) : (
                <span>Save & Publish Product</span>
              )}
            </button>
          </div>
        </section>
      </form>

      {/* Success modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-outline-variant rounded-2xl w-full max-w-md p-6 md:p-8 relative shadow-xl">
            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-secondary-app hover:text-primary p-1 cursor-pointer"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-[24px]">
                close
              </span>
            </button>

            <div className="text-center mb-6">
              <span
                className="material-symbols-outlined text-[48px] text-emerald-600 font-semibold mb-2"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <h3 className="font-display font-bold text-2xl text-primary">
                Saved Successfully!
              </h3>
              <p className="text-xs text-secondary-app mt-2">
                The product has been saved. Copy the link below or share it
                directly.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-secondary-app mb-2">
                Shareable Link
              </label>
              <div className="flex bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden p-1">
                <input
                  type="text"
                  readOnly
                  value={getShareLink()}
                  className="bg-transparent border-0 flex-1 px-3 py-2 text-xs text-on-surface focus:ring-0 focus:outline-none min-w-0"
                />
                <button
                  onClick={handleCopyLink}
                  className="bg-primary hover:bg-primary-dark text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copied ? "check" : "content_copy"}
                  </span>
                  <span>{copied ? "Copied!" : "Copy"}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary-app">
                Share on Apps
              </p>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Check out this product from our catalog: ${getShareLink()}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-outline-variant hover:bg-surface-container-low rounded-xl py-3 px-4 transition-colors cursor-pointer text-xs font-semibold text-primary"
                >
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                    chat
                  </span>
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Check out this product from our catalog: ${getShareLink()}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-outline-variant hover:bg-surface-container-low rounded-xl py-3 px-4 transition-colors cursor-pointer text-xs font-semibold text-primary"
                >
                  <span className="material-symbols-outlined text-emerald-800 text-[18px]">
                    business
                  </span>
                  <span>WA Business</span>
                </a>
                <a
                  href={getShareLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-outline-variant hover:bg-surface-container-low rounded-xl py-3 px-4 transition-colors cursor-pointer text-xs font-semibold text-primary col-span-2"
                >
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">
                    open_in_browser
                  </span>
                  <span>Open in Chrome / Browser</span>
                </a>
                <Link
                  href="/catalog"
                  className="flex items-center justify-center gap-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl py-3 px-4 transition-colors cursor-pointer text-xs font-semibold text-primary col-span-2"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    grid_view
                  </span>
                  <span>Back to dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
