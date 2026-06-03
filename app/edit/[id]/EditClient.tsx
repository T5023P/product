"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, deleteDoc, getDoc, updateDoc, collection, onSnapshot } from "firebase/firestore";
import { db, storage } from "../../../lib/firebase";
import { compressImage } from "../../../lib/compressImage";
import ImageCropper from "../../(admin)/ImageCropper";

interface UploadedFile {
  id: string;
  name: string;
  progress: number;
  url?: string;
}

interface ProductDoc {
  name: string;
  description: string;
  price: number | null;
  imageUrls: string[];
  categories?: string[];
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [initial, setInitial] = useState<ProductDoc | null>(null);

  // Surviving images (existing URLs minus any the user staged for removal).
  const [keptImageUrls, setKeptImageUrls] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // Newly uploaded files for this edit session (mirrors new/page.tsx shape).
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (cancelled) return;
        if (!snap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = snap.data() as Partial<ProductDoc>;
        const product: ProductDoc = {
          name: typeof data.name === "string" ? data.name : "",
          description:
            typeof data.description === "string" ? data.description : "",
          price:
            typeof data.price === "number"
              ? data.price
              : data.price == null
                ? null
                : Number(data.price) || null,
          imageUrls: Array.isArray(data.imageUrls)
            ? data.imageUrls.filter((u): u is string => typeof u === "string")
            : [],
        };
        if (Array.isArray((snap.data() as any).categories)) {
          setSelectedCategories((snap.data() as any).categories.filter((c: any) => typeof c === "string"));
        }
        setInitial(product);
        setKeptImageUrls(product.imageUrls);
        setLoading(false);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error("Failed to load product:", err);
        const message =
          err instanceof Error ? err.message : "Failed to load product.";
        setLoadError(message);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
  // load categories (separate effect)
  useEffect(() => {
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

  const removeNewUpload = (uploadId: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== uploadId));
  };

  // NOTE: Removing an existing image only stages it for removal from the
  // product's `imageUrls` array. We do NOT delete the underlying object from
  // Firebase Storage here — Storage cleanup is out of scope for this change.
  const removeExistingImage = (url: string) => {
    setKeptImageUrls((prev) => prev.filter((u) => u !== url));
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

  const handleDeleteProduct = async () => {
    if (!initial) return;
    const confirmed = window.confirm(
      `Delete “${initial.name}”? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setSubmitError("");
    try {
      await deleteDoc(doc(db, "products", id));
      router.push("/");
    } catch (err: unknown) {
      console.error("Delete failed", err);
      const message =
        err instanceof Error ? err.message : "Failed to delete product.";
      setSubmitError(message);
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!id) return;
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

      const newUrls = uploads
        .filter((u) => u.url)
        .map((u) => u.url as string);

      const imageUrls = [...keptImageUrls, ...newUrls];

      // Intentionally NOT touching `createdAt`.
      await updateDoc(doc(db, "products", id), {
        name,
        description,
        price: price || null,
        imageUrls,
        categories: selectedCategories,
      });

      router.push("/");
    } catch (err: unknown) {
      console.error("Error saving product: ", err);
      const message =
        err instanceof Error ? err.message : "Failed to save product.";
      setSubmitError(message);
      setIsPending(false);
    }
  };

  // ---- Render: loading ----
  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // ---- Render: not found ----
  if (notFound) {
    return (
      <main className="flex-1 px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto w-full">
        <div className="max-w-md mx-auto bg-white border border-outline-variant rounded-xl p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-[48px] text-secondary-app mb-4">
            sentiment_dissatisfied
          </span>
          <h1 className="font-display text-2xl font-bold text-primary tracking-tight">
            Product Not Found
          </h1>
          <p className="text-sm text-secondary-app mt-2">
            The product you&apos;re trying to edit doesn&apos;t exist or has
            been removed.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 inline-flex items-center gap-1.5 text-secondary-app hover:text-primary text-sm font-medium cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
            <span>Back</span>
          </button>
        </div>
      </main>
    );
  }

  // ---- Render: load error ----
  if (loadError) {
    return (
      <main className="flex-1 px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto w-full">
        <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200">
          {loadError}
        </div>
      </main>
    );
  }

  if (!initial) {
    // Defensive — should not hit because loading/notFound/loadError covers it.
    return null;
  }

  const isUploading = uploads.some((u) => u.progress < 100);
  const completedNewUploads = uploads.filter((u) => u.url);
  const totalImages = keptImageUrls.length + completedNewUploads.length;
  const hasNoImages = totalImages === 0;

  return (
    <main className="flex-1 px-6 md:px-12 py-8 md:py-12 max-w-5xl mx-auto w-full">
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-1.5 text-secondary-app hover:text-primary text-sm font-medium mb-6 cursor-pointer transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">
          arrow_back
        </span>
        <span>Back</span>
      </button>

      <header className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-primary tracking-tight">
          Edit Product
        </h1>
        <p className="text-secondary-app mt-2 text-sm md:text-base">
          Update images and details for this piece.
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
        {/* Left: image management */}
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

          {/* Existing image thumbnails (kept) */}
          {keptImageUrls.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary-app">
                Current Images
              </h3>
              <div className="flex flex-wrap gap-3">
                {keptImageUrls.map((url) => (
                  <div
                    key={url}
                    className="relative w-20 h-24 rounded-lg overflow-hidden border border-outline-variant bg-surface-container"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Existing product image"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(url)}
                      aria-label="Remove image"
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        close
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New uploads in progress / ready */}
          {uploads.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-secondary-app">
                New Uploads
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
                      onClick={() => removeNewUpload(upload.id)}
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
                  defaultValue={initial.name}
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
                    defaultValue={
                      initial.price === null || initial.price === undefined
                        ? ""
                        : String(initial.price)
                    }
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
                  defaultValue={initial.description}
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

          <div className="space-y-4">
            <button
              type="submit"
              disabled={isPending || isUploading || hasNoImages}
              className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 touch-manipulation text-base cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : isUploading ? (
                <span>
                  Uploading Images (
                  {uploads.filter((u) => u.progress < 100).length} left)...
                </span>
              ) : hasNoImages ? (
                <span>Keep at least 1 image to save</span>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
              className="w-full inline-flex items-center justify-center gap-2 border border-red-600 text-red-600 hover:bg-red-50 font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined">delete</span>
              {isDeleting ? "Deleting..." : "Delete Product"}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
