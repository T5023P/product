# Catalog Bug Fixes — Bugfix Requirements Document

## Introduction

Two related defects affect the catalog-app deployed at `catalog-app-iota-green.vercel.app`:

- **Bug 1 — Stale catalog grid.** After an admin creates a product through `/admin`, the new product does not appear on the home page (`/`) for up to 60 seconds because the route is served from the ISR cache (`export const revalidate = 60` in `app/page.tsx`). The admin form writes to Firestore from a Client Component (`addDoc` in `app/admin/page.tsx`) and never invalidates the home cache. The result is that creators see a "Saved Successfully" confirmation, navigate to `/`, and find the product missing — undermining trust in the tool.
- **Bug 2 — Slow images on shared links.** When the shared URL `https://catalog-app-iota-green.vercel.app/p/<id>` is opened on a phone, hero and gallery images take many seconds to render. The dominant cause is a malformed `sizes` attribute on the `<Image>` components in `app/page.tsx` and `app/p/[id]/ProductGallery.tsx` (`(max-w-768px) 100vw, ...` is not valid CSS — the correct syntax is `(max-width: 768px) 100vw, ...`). Because the browser cannot match any media condition, it falls back to the default and `next/image` serves the largest `srcset` variant (often 1920w/3840w). A secondary cause is that admin uploads send the original camera-resolution files to Firebase Storage (3-8 MB hero images) with no client-side compression.

Both bugs surface to end users on production and degrade the perceived quality of the catalog. They are unrelated in cause but are batched into one spec because they share a deploy and a small set of files.

## Bug Analysis

### Current Behavior (Defect)

What currently happens when each bug is triggered.

1.1 WHEN an authenticated admin successfully submits the new-product form on `/admin` (Firebase Storage uploads complete, `addDoc` to the `products` Firestore collection succeeds, and the success modal shows) AND the admin then loads `/` within 60 seconds THEN the system renders the cached ISR HTML and omits the newly created product from the grid.

1.2 WHEN any visitor renders an `<Image>` declared in `app/page.tsx` whose `sizes` attribute is `"(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"` THEN the browser fails to match any media condition (the strings `max-w-768px` / `max-w-1200px` are not valid CSS media features), falls back to the default of the widest candidate, and downloads a `srcset` variant much larger than the rendered slot (commonly 1920w or larger).

1.3 WHEN any visitor opens `/p/<id>` and `ProductGallery` renders its main `<Image>` whose `sizes` attribute is `"(max-w-640px) 100vw, 640px"` THEN the browser fails to match the media condition, falls back to the default, and downloads a `srcset` variant much larger than the 640px-wide rendered slot.

1.4 WHEN an authenticated admin selects an image from a phone camera or DSLR (typical 3-8 MB JPEG, 4000px+ on the long edge) and submits the form THEN the system uploads the original bytes verbatim to Firebase Storage with no resize or recompression, so every subsequent request to `/p/<id>` and `/` re-downloads the unoptimized full-resolution master through the `next/image` optimizer.

### Expected Behavior (Correct)

What should happen instead. Each clause corresponds to a defect clause above.

2.1 WHEN an authenticated admin successfully submits the new-product form on `/admin` THEN the system SHALL invalidate the cached `/` route (and the dynamic `/p/[id]` page route) on the server so that the next navigation to `/` (within a small bounded window, e.g. one round trip) renders HTML that includes the newly created product.

2.2 WHEN any visitor renders an `<Image>` in `app/page.tsx` THEN the system SHALL emit a `sizes` attribute composed of valid CSS media-query syntax (e.g. `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw`) so that the browser selects the smallest `srcset` candidate large enough for the rendered slot.

2.3 WHEN any visitor renders the main and thumbnail `<Image>` components in `app/p/[id]/ProductGallery.tsx` THEN the system SHALL emit a `sizes` attribute composed of valid CSS media-query syntax (e.g. `(max-width: 640px) 100vw, 640px`) so the browser selects an appropriately-sized `srcset` candidate (≤ 640px wide for the main image on mobile).

2.4 WHEN an authenticated admin selects an image to upload THEN the system SHALL resize the image client-side to a maximum of 1600 px on the long edge, re-encode at JPEG quality ≈ 0.82 (or WebP via `canvas.toBlob('image/webp', 0.82)` when the browser supports it), and upload only the compressed blob to Firebase Storage, so that no upload exceeds roughly 500 KB for a typical photographic input.

### Unchanged Behavior (Regression Prevention)

Existing behavior that must be preserved by the fix.

3.1 WHEN a visitor loads `/` and no product mutation has occurred recently THEN the system SHALL CONTINUE TO serve the home grid quickly via ISR / cached rendering without forcing dynamic rendering on every request.

3.2 WHEN any visitor loads `/`, `/p/<id>`, or `/admin` and the input contains valid `sizes` attributes (after the fix) THEN the system SHALL CONTINUE TO render the same product cards, gallery layout, thumbnails, and copy with the same DOM structure and Tailwind classes as before.

3.3 WHEN an authenticated admin submits the form, regardless of whether image bytes are resized or sent verbatim THEN the system SHALL CONTINUE TO upload through Firebase Storage `uploadBytesResumable`, surface progress per file in the upload list, write a Firestore document containing `name`, `description`, `price`, `imageUrls`, and `createdAt`, show the success modal, and expose the share link `${origin}/p/<id>`.

3.4 WHEN an unauthenticated user visits `/admin` THEN the system SHALL CONTINUE TO require login via `signInWithEmailAndPassword` before exposing the form.

3.5 WHEN an admin uploads an asset that is already small (e.g. 200 KB, 800 px wide, or already in WebP) THEN the system SHALL CONTINUE TO upload it without enlarging it; the resize/compress step must be a no-op or near-no-op for inputs already inside the size budget.

3.6 WHEN any image is rendered after the fix THEN the system SHALL CONTINUE TO use `next/image` with the existing `fill`, `priority` (where already set), `className`, and `alt` props unchanged; only the `sizes` string is rewritten.

3.7 WHEN a visitor loads `/p/<id>` THEN the system SHALL CONTINUE TO render the same Open Graph / Twitter card metadata produced by `generateMetadata`, the same WhatsApp contact bar, and the same product copy.

## Bug Condition Summary

For traceability, the bug conditions derived from the clauses above are:

```pascal
FUNCTION isBug1Condition(event)
  // Bug 1: stale home grid
  INPUT: event of type ProductCreationEvent { docId, createdAt }
  OUTPUT: boolean

  RETURN addDocSucceeded(event)
         AND timeSinceCreate(event) < 60_seconds
         AND NOT homePageContains(event.docId)
END FUNCTION
```

```pascal
FUNCTION isBug2Condition(image)
  // Bug 2a: invalid sizes syntax
  INPUT: image of type NextImageUsage { file, sizesString }
  OUTPUT: boolean

  RETURN file IN { 'app/page.tsx', 'app/p/[id]/ProductGallery.tsx' }
         AND NOT isValidCssSizesSyntax(image.sizesString)
END FUNCTION
```

```pascal
FUNCTION isBug2bCondition(upload)
  // Bug 2b: oversized uploads
  INPUT: upload of type ImageUpload { sourceFileBytes, sourceLongEdgePx }
  OUTPUT: boolean

  RETURN upload.sourceLongEdgePx > 1600
         AND upload.sourceFileBytes > 500_000
         AND uploadedBytesEqualSourceBytes(upload)
END FUNCTION
```

The non-bug domains (cases that must be preserved) are the negations of the conditions above plus the `CONTINUE TO` clauses in section 3.
