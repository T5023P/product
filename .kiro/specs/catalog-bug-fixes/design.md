# Catalog Bug Fixes — Bugfix Design

## Overview

This design covers two unrelated defects shipped together as a single deploy:

- **Bug 1 — Stale catalog grid.** Fix by routing product creation through a Server Action (`app/admin/actions.ts`) that calls `revalidatePath('/')` and `revalidatePath('/p/[id]', 'page')` after `addDoc` succeeds. The home page keeps `export const revalidate = 60` so anonymous visitors continue to be served quickly from the ISR cache; a successful admin write now also invalidates that cache so the next render produces fresh HTML containing the new product. This is preferred over `force-dynamic` because it preserves home-page latency for the read-heavy public traffic.
- **Bug 2 — Slow images on shared links.** Fix in two layers:
  1. Replace the malformed `sizes` strings on every `<Image>` in `app/page.tsx` and `app/p/[id]/ProductGallery.tsx` with valid CSS media-query syntax. This is the highest-impact, lowest-risk change — it lets `next/image` pick a srcset candidate appropriate for the rendered slot instead of always serving the widest variant.
  2. Add a small client-side resize-and-compress step in `app/admin/page.tsx` before `uploadBytesResumable`, targeting `≤ 1600 px` on the long edge and JPEG quality ≈ 0.82 (or WebP when `canvas.toBlob('image/webp', ...)` is supported). This caps the source bytes that Firebase Storage and the `next/image` optimizer have to deal with.

The fixes are surgical — no architectural rewrite, no schema migration, and no change to Firestore structure or Firebase Storage paths. Verified against `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md` and the route segment config docs for Next.js 16.2.6.

## Glossary

- **Bug_Condition (C)**: The set of inputs that trigger one of the defects (see `bugfix.md`).
- **Property (P)**: The desired post-fix behavior on a buggy input — fresh HTML for Bug 1, valid `sizes` and a downscaled upload for Bug 2.
- **Preservation**: Every behavior listed under Section 3 of `bugfix.md` (ISR speed, identical DOM, identical Firestore schema, identical share link, etc.) must remain unchanged.
- **ISR**: Incremental Static Regeneration. In Next 16 (without Cache Components, which this app does not enable) `export const revalidate = 60` causes a route to be cached and re-rendered at most every 60 seconds.
- **`revalidatePath(path, type?)`**: Next 16 API exported from `next/cache`, callable from Server Actions and Route Handlers, invalidates the cache for a route. Use `revalidatePath('/')` for the home, and `revalidatePath('/p/[id]', 'page')` for the dynamic product page (the docs require the `'page'` type whenever the path contains a dynamic segment).
- **`saveProductAction`**: The existing but currently unused server action in `app/admin/actions.ts`. We will extend it with `revalidatePath` calls and wire it into the admin form.
- **`<Image>` `sizes` prop**: A standard HTML `sizes` string (per [`next/image` docs](node_modules/next/dist/docs/01-app/03-api-reference/02-components/image.md)). Must use valid CSS media-feature syntax such as `(max-width: 768px)`, never the Tailwind-style `(max-w-768px)`.
- **`canvas.toBlob`**: Browser API used to re-encode a `<canvas>` to a compressed `image/jpeg` or `image/webp` `Blob`. Available in all browsers we target; WebP support is detectable via a feature probe.

## Bug Details

### Bug 1 Condition — Stale Home Grid

The bug manifests after a successful product creation. The admin form in `app/admin/page.tsx` calls `addDoc` directly from a Client Component, which can never invoke `revalidatePath` (the API only works in server environments). The home route declares `export const revalidate = 60`, so its rendered HTML is held by the ISR cache for up to 60 seconds and the new product is invisible until the cache age expires.

**Formal Specification:**
```
FUNCTION isBug1Condition(event)
  INPUT: event of type ProductCreationEvent { docId, createdAt }
  OUTPUT: boolean

  RETURN addDocSucceeded(event)
         AND timeSinceCreate(event) < ISR_REVALIDATE_WINDOW   // 60s
         AND NOT homePageContains(event.docId)
END FUNCTION
```

#### Examples

- Admin creates "Ceramic Vase" at 12:00:00, navigates to `/` at 12:00:05 → vase missing (defect). After fix → vase visible.
- Admin creates a product, copies the share link from the modal, opens it on the same device → product detail shows correctly (already works), but home is still stale (defect). After fix → home is fresh on next navigation.
- Admin creates two products in succession; only the cache-busting on the second creation will refresh the page if the first did not. After fix → either creation triggers a revalidate.

### Bug 2 Condition — Invalid `sizes` Strings & Oversized Uploads

The bug manifests in two related ways:

**Bug 2a: Invalid `sizes` syntax.** `app/page.tsx` declares `sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"` and `app/p/[id]/ProductGallery.tsx` declares `sizes="(max-w-640px) 100vw, 640px"`. Neither `max-w-768px` nor `max-w-1200px` nor `max-w-640px` is a valid CSS media feature. The browser cannot match any media condition and falls back to the default candidate, which is the widest entry in `next/image`'s generated `srcset` (commonly 1920w or 3840w).

**Bug 2b: Oversized uploads.** Firebase Storage receives the original 3-8 MB camera files. The `next/image` optimizer must fetch and process those bytes on the first request to each device-pixel-ratio variant, increasing time-to-first-byte and increasing the optimized output size for high-DPR variants.

**Formal Specifications:**
```
FUNCTION isBug2aCondition(image)
  INPUT: image of type NextImageUsage { file, sizesString }
  OUTPUT: boolean

  RETURN file IN { 'app/page.tsx', 'app/p/[id]/ProductGallery.tsx' }
         AND NOT isValidCssSizesSyntax(image.sizesString)
END FUNCTION

FUNCTION isBug2bCondition(upload)
  INPUT: upload of type ImageUpload { sourceFileBytes, sourceLongEdgePx }
  OUTPUT: boolean

  RETURN upload.sourceLongEdgePx > 1600
         AND upload.sourceFileBytes > 500_000
         AND uploadedBytesEqualSourceBytes(upload)
END FUNCTION
```

`isValidCssSizesSyntax(s)` is the predicate "every media condition in `s`, after splitting on commas, either parses as a CSS `<media-feature>` (e.g. `(max-width: 768px)`) or is the trailing default value (`100vw`, `50vw`, `33vw`, `640px`, etc.)". A pragmatic regex for this is `^(\s*\((min|max)-(width|height):\s*\d+(px|em|rem)\)\s+\S+\s*,\s*)*\s*\S+\s*$`.

#### Examples

- Mobile visitor opens `/p/<id>` with a 1080-CSS-pixel viewport. With the buggy `sizes`, `next/image` selects the 1920w variant (~600 KB). After fix, it selects the 750w variant (~80 KB) — roughly 7× less data on the wire.
- Admin uploads a 6 MB iPhone JPEG. With the buggy upload, Firebase stores 6 MB and `next/image` optimizes from 6 MB. After fix, the client uploads ~250 KB (1600 px wide, q ≈ 0.82) and `next/image` optimizes from a much smaller source.
- A small UI asset (200 KB, 800 px wide) is uploaded. After fix, the resize step detects the long edge is already ≤ 1600 px and returns the original blob without re-encoding (preserves Section 3.5).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Anonymous home-page visits remain ISR-cached with a 60-second window; no shift to `force-dynamic`.
- DOM, Tailwind classes, layout, hover effects, and copy on `/`, `/p/[id]`, and `/admin` remain identical.
- Firestore document shape (`name`, `description`, `price`, `imageUrls`, `createdAt`) is unchanged.
- Firebase Storage path scheme (`products/${Date.now()}_${file.name}`) is unchanged.
- Share link format (`${origin}/p/<id>`) is unchanged.
- Authentication flow (login screen, `onAuthStateChanged`, sign out) is unchanged.
- WhatsApp contact bar, Open Graph metadata, and product detail copy are unchanged.
- Existing `priority` on `ProductGallery`'s main image and on first-item home cards is unchanged.

**Scope:**
All inputs that do NOT match the bug conditions should be completely unaffected:
- Anonymous home-page visits with no recent product creation (preserved by keeping ISR).
- Already-small uploads (≤ 1600 px on the long edge) — pass through without re-encoding.
- Mouse interactions, login form, sign-out button, share modal, copy-link button, WhatsApp links — all untouched.

The actual expected correct behavior is defined in the Correctness Properties section below.

## Hypothesized Root Cause

### Bug 1

1. **Client-side mutation, server-side cache.** `addDoc` runs in the browser (Client Component). The Firestore write succeeds, but the App Router page cache for `/` lives on the server and is not aware of it. Without an explicit `revalidatePath`, the cached HTML stays valid for its full 60-second TTL.
2. **Unused server action.** `app/admin/actions.ts` already exists (`saveProductAction`) but is never called. It is the natural place to add `revalidatePath`.
3. **Misalignment between authoring path and read path.** Home is cached for 60s, but the admin's mental model is "I just saved this; it should be visible immediately." This mismatch is the surface symptom; the root cause is the missing cache invalidation.

### Bug 2

1. **Tailwind-style media expression in `sizes`.** The `sizes` strings (`(max-w-768px)`, `(max-w-1200px)`, `(max-w-640px)`) look like Tailwind class names mistakenly placed inside a CSS-syntax string. Likely copy-paste error from a Tailwind className. Browsers silently ignore unparseable media conditions and fall through to the default value, which is the last entry in `srcset`.
2. **No client-side compression on upload.** Modern phones produce JPEGs in the 3-8 MB range; the catalog never needs more than ~1600 px on the long edge given the rendered slots (max ~640 px on the gallery, max ~33vw on the home grid). Uploading at full camera resolution is pure waste.
3. **Subordinate factor — no `placeholder="blur"`.** A blank container during streaming makes perceived load worse, but blur placeholders for remote URLs require server-side processing or a `blurDataURL` per image. Skipping this for now to keep the fix simple.
4. **Subordinate factor — `/p/[id]` has no `revalidate` hint.** It is dynamic by default, which affects HTML latency, not image bytes. Not in scope for Bug 2; mentioned for completeness.

## Correctness Properties

Property 1: Bug Condition - Home Grid Reflects New Products After Admin Save

_For any_ successful product creation through `/admin` (Firebase Storage uploads complete and `addDoc` returns a docRef), the fixed system SHALL invalidate the home route's cache via `revalidatePath('/')` (and the dynamic `/p/[id]` page route via `revalidatePath('/p/[id]', 'page')`) before returning to the client, so that the next request to `/` renders HTML containing the new product's id.

**Validates: Requirements 2.1**

Property 2: Preservation - Home Page ISR & Admin Form Behavior Unchanged

_For any_ input that does NOT match the Bug 1 condition (anonymous visit to `/` with no recent admin write, or an admin form submit that fails validation, or any non-admin route), the fixed code SHALL produce the same observable behavior as the original code, preserving ISR cache hits for anonymous traffic, identical DOM output, identical Firestore document shape, identical Firebase Storage paths, and the identical success modal with the same share link format.

**Validates: Requirements 3.1, 3.3, 3.4, 3.7**

Property 3: Bug Condition - Valid `sizes` Strings on All `<Image>` Usages

_For any_ `<Image>` component rendered by `app/page.tsx` or `app/p/[id]/ProductGallery.tsx`, the `sizes` prop in the fixed code SHALL parse as a syntactically valid CSS `sizes` attribute — every media condition in the comma-separated list is either a `(min-width: …)` / `(max-width: …)` expression with a numeric length, or the final default token (e.g. `33vw`, `640px`).

**Validates: Requirements 2.2, 2.3**

Property 4: Bug Condition - Uploaded Images Bounded in Size

_For any_ admin upload of an image whose long edge exceeds 1600 px, the fixed `handleFileChange` SHALL pass a `Blob` to `uploadBytesResumable` whose decoded long edge is ≤ 1600 px and whose byte length is no greater than the original file's byte length, while uploads whose long edge is already ≤ 1600 px and whose byte length is already ≤ ~500 KB SHALL pass through unmodified or near-unmodified.

**Validates: Requirements 2.4, 3.5**

Property 5: Preservation - Image Rendering & Upload Pipeline Unchanged Outside Buggy Inputs

_For any_ `<Image>` whose `sizes` is rewritten or any upload that is resized, the fixed code SHALL preserve every other property: same `src`, `alt`, `fill`, `priority`, `className`; same Firestore document; same `imageUrls` array length and ordering; same upload progress reporting; same per-upload thumbnail in the upload list; same `getDownloadURL` flow.

**Validates: Requirements 3.2, 3.3, 3.6**

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct:

**File:** `app/admin/actions.ts`

**Function:** `saveProductAction` (already exists; extend it).

**Specific Changes:**
1. **Import `revalidatePath`** from `next/cache`.
2. **After a successful `addDoc`**, call `revalidatePath('/')` and `revalidatePath('/p/[id]', 'page')`. Note the docs require the `'page'` type whenever the path contains a dynamic segment.
3. **Return the same shape** the form already expects (`{ success: true, id }` / `{ success: false, error }`).

**File:** `app/admin/page.tsx`

**Function:** `handleSubmit`

**Specific Changes:**
1. **Stop calling `addDoc` from the client.** Instead, build a `FormData` with `name`, `description`, `price`, and a JSON-stringified `imageUrls` array, then call `saveProductAction(null, formData)`.
2. **Replace the inline progress spinner branch's success path** to drive `setCreatedId` / `setShowSuccessModal` from the action's return value.
3. **Keep all upload-progress logic intact** — `uploadBytesResumable`, `uploadTask.on('state_changed', …)`, and the per-file progress UI continue to live in the Client Component because Firebase Storage uploads from the browser are still the simplest authenticated-user upload path.
4. **Add a `compressImage` helper** (in `app/admin/page.tsx` or a new `lib/compressImage.ts`) that:
   - Reads the input `File` into an `ImageBitmap` (or fallback `<img>`).
   - If long edge ≤ 1600 px AND `file.size` ≤ ~500 KB, returns the original `File` (preserves 3.5).
   - Otherwise, draws to an off-screen `<canvas>` scaled so the long edge equals 1600 px, then `canvas.toBlob('image/webp', 0.82)` if `HTMLCanvasElement.prototype.toBlob` supports `image/webp`, else `'image/jpeg'` at 0.82.
   - Returns the resulting `Blob` (typed as `Blob | File`) with `name` and `type` propagated.
5. **In `handleFileChange`**, await `compressImage(file)` for each selected file before calling `uploadBytesResumable(storageRef, compressedBlob)`. The storage path keeps the original filename for traceability; the content type is whatever `compressImage` returned.

**File:** `app/page.tsx`

**Specific Changes:**
1. **Replace** `sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"` with `sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"`.
2. Leave `export const revalidate = 60` unchanged — Bug 1 is fixed via `revalidatePath`, not by removing ISR.

**File:** `app/p/[id]/ProductGallery.tsx`

**Specific Changes:**
1. **Replace** `sizes="(max-w-640px) 100vw, 640px"` with `sizes="(max-width: 640px) 100vw, 640px"`.
2. Thumbnail `sizes="80px"` is already valid; leave it.
3. `priority` on the main image is already set; leave it.

**File:** `next.config.ts`

**Specific Changes:**
1. **Verify only.** Next 16's default `images.formats` includes AVIF and WebP. No change required unless verification shows otherwise; the existing `remotePatterns` for Firebase are correct.

**Out of scope (deliberately):**
- Adding `placeholder="blur"` would require a per-image `blurDataURL`. Skipped to keep the fix small.
- Adding `revalidate` to `/p/[id]` would change cache semantics for product pages and is not required to fix either bug.

## Testing Strategy

### Validation Approach

A two-phase strategy:
1. Write tests that demonstrate each bug **before** any fix is applied.
2. Apply the fixes and confirm those tests now pass while a separate set of preservation tests continues to pass.

Tests are split into two property-based test files (one for each bug condition) plus a preservation property test, run under a lightweight test runner that does not currently exist in the repo. The first task in `tasks.md` will set up the runner (Vitest) since the project has no test infrastructure today.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing the fix. Confirm or refute the root-cause analysis.

**Test Plan**:
- For Bug 1, write a property test that asserts: for any product written to a fake products store, the home page's data-fetch function `getProducts` (or, when a runtime test environment exists, the rendered HTML output of `/`) returns the new product within an acceptable window (e.g. immediately after `revalidatePath` is called). On UNFIXED code, the test will fail because the server action call site never invokes `revalidatePath`.
- For Bug 2a (sizes syntax), write a static-source property test that scans every `<Image …/>` element in `app/**/*.tsx`, extracts its `sizes` attribute, and asserts the string parses with the `isValidCssSizesSyntax` regex. On UNFIXED code, three usages fail (two on `app/page.tsx`, one on `ProductGallery.tsx`).
- For Bug 2b (upload sizing), write a property test for the (not-yet-existing) `compressImage` helper that asserts: for arbitrary input width × height ∈ \[100, 4000\] and arbitrary content, `compressImage` returns a blob whose decoded long edge is ≤ 1600 px and whose byte length is ≤ the input byte length. On UNFIXED code, the helper does not exist — the import will fail, which is itself a counterexample.

**Test Cases**:
1. **Sizes-syntax property test**: scan `app/**/*.tsx` for JSX `<Image>` and validate every `sizes` literal (will fail on unfixed code: 3 invalid strings).
2. **Compress-then-upload property test**: assert post-condition of `compressImage` (will fail on unfixed code: helper does not exist).
3. **Revalidate-after-create property test**: assert that calling `saveProductAction` results in the `revalidatePath('/')` call on the server (will fail on unfixed code: `revalidatePath` is never invoked).

**Expected Counterexamples**:
- `app/page.tsx:99` — `sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"` does not match the valid-syntax regex.
- `app/p/[id]/ProductGallery.tsx:30` — `sizes="(max-w-640px) 100vw, 640px"` does not match.
- `saveProductAction` in `app/admin/actions.ts` does not import `revalidatePath`.
- `compressImage` does not exist.

For deterministic bugs (sizes-syntax, missing helper, missing import) the property is scoped to enumerating the concrete failing cases. For the home-grid staleness, since we cannot easily exercise the Vercel ISR cache in unit tests, the property is reframed at the unit boundary as "after `saveProductAction` runs successfully, `revalidatePath` is observed to have been called with `'/'`". A higher-fidelity end-to-end check is left as a manual smoke test in the deploy step.

### Fix Checking

**Goal**: Verify that for all inputs where a bug condition holds, the fixed function produces the expected behavior.

**Pseudocode (Bug 1):**
```
FOR ALL formData WHERE addDoc would succeed DO
  result := saveProductAction_fixed(null, formData)
  ASSERT result.success = true
  ASSERT revalidatePathSpy.calls CONTAINS ('/')
  ASSERT revalidatePathSpy.calls CONTAINS ('/p/[id]', 'page')
END FOR
```

**Pseudocode (Bug 2a):**
```
FOR ALL imageUsage IN findAllNextImageUsages('app/**/*.tsx') DO
  ASSERT isValidCssSizesSyntax(imageUsage.sizesString)
END FOR
```

**Pseudocode (Bug 2b):**
```
FOR ALL file IN { generated images: long_edge ∈ [100, 4000], width × height pairs } DO
  blob := compressImage_fixed(file)
  ASSERT decodedLongEdge(blob) ≤ 1600
  ASSERT blob.size ≤ file.size
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug conditions do NOT hold, the fixed code behaves identically to the original.

**Pseudocode:**
```
// Already-small uploads pass through
FOR ALL file WHERE longEdge(file) ≤ 1600 AND file.size ≤ 500_000 DO
  blob := compressImage_fixed(file)
  ASSERT blob.size ≤ file.size
  ASSERT decodedDimensions(blob) = decodedDimensions(file)
END FOR

// Anonymous home visits with no recent write are still ISR-cached
FOR ALL request TO '/' WHERE no_recent_admin_write DO
  ASSERT response.headers indicates ISR cache hit (or static prerender)
END FOR

// Image src/alt/fill/priority preserved
FOR ALL imageUsage IN findAllNextImageUsages('app/**/*.tsx') DO
  ASSERT imageUsage.props_other_than_sizes_fixed = imageUsage.props_other_than_sizes_original
END FOR
```

**Testing Approach**: Property-based testing fits preservation well — preservation is fundamentally a "for all non-buggy inputs" claim, and property-based tests cover broader input domains than handwritten unit tests. We will use `fast-check` (the standard PBT library for the JavaScript ecosystem) under Vitest.

**Test Plan**: Observe the unfixed behavior first (image with `src=X`, `alt=Y`, `fill`, `priority`, no extra props; Firestore doc shape; share link format), then encode each observation as a property the fixed code must satisfy across many generated inputs.

**Test Cases**:
1. **Image props preservation**: every `<Image>` after fix has the same `src`, `alt`, `fill`, `className`, and `priority` as before; only `sizes` differs.
2. **Already-small upload preservation**: `compressImage` on a 200 KB / 800 px input returns a blob with `≤ original.size` and the same decoded dimensions.
3. **Firestore doc shape preservation**: `saveProductAction` output document always contains exactly the fields `{ name, description, price, imageUrls, createdAt }`.
4. **Share link format preservation**: post-fix admin success modal still computes `${origin}/p/<id>`.

### Unit Tests

- `isValidCssSizesSyntax` regex on a fixed list of known-good and known-bad strings (sanity check on the predicate).
- `compressImage` returns the original on small inputs.
- `compressImage` re-encodes large inputs to ≤ 1600 px.
- `saveProductAction` returns `{ success: false, error }` on missing required fields.
- `saveProductAction` calls `revalidatePath('/')` exactly once and `revalidatePath('/p/[id]', 'page')` exactly once on success.

### Property-Based Tests

- For arbitrary widths and heights in `[100, 4000]`, `compressImage` output long edge ≤ 1600 and `output.size ≤ input.size`.
- For arbitrary product names / descriptions / prices, `saveProductAction` produces a doc with the canonical shape, and on success calls `revalidatePath` with the two expected arguments.
- For arbitrary `sizes` strings drawn from `app/**/*.tsx`, `isValidCssSizesSyntax` returns `true` after the fix.

### Integration Tests

- Manual smoke test post-deploy:
  1. Sign in to `/admin` on the deployed Vercel URL.
  2. Create a product with one image.
  3. Open `/` on the same device — new product is visible immediately.
  4. Open `/` on a different device / private window — new product is also visible.
  5. Open `/p/<id>` on a phone over a throttled connection — first paint of hero image arrives within a couple of seconds, payload is well under 1 MB.
- DevTools verification: on `/p/<id>`, the picked `srcset` candidate matches the rendered slot (`≤ 750w` on a 1080-CSS-pixel viewport).
