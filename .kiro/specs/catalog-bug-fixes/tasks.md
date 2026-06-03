# Implementation Plan

## Overview

This plan fixes two unrelated defects in `catalog-app` and ships them to Vercel together:

- **Bug 1** — Newly created products do not appear on `/` because the route is ISR-cached and the admin form (a Client Component) cannot invoke `revalidatePath`. Fixed by routing the write through the existing `saveProductAction` server action and calling `revalidatePath('/')` plus `revalidatePath('/p/[id]', 'page')` after `addDoc` succeeds.
- **Bug 2** — Images on `/p/[id]` load slowly. Fixed in two layers: repair the malformed `sizes` strings on every `<Image>` (so `next/image` picks an appropriately-sized srcset variant), and add a small client-side resize/compress step before upload so Firebase Storage holds reasonable bytes.

Tasks are ordered: test infrastructure → exploration tests (must FAIL pre-fix) → preservation tests (must PASS pre-fix) → fix Bug 1 → fix Bug 2a → fix Bug 2b → verify all tests → build → deploy → final checkpoint.

## Task Dependency Graph

```
1 (test infra)
 ├── 2 (exploration tests — must FAIL)
 └── 3 (preservation tests — must PASS)
        │
        ▼
4 (fix Bug 1)        — depends on 2, 3
5 (fix Bug 2a sizes) — depends on 2, 3
6 (fix Bug 2b upload)— depends on 2, 3
7 (verify next.config) — depends on 5
        │
        ▼
8 (verify tests pass) — depends on 4, 5, 6
        │
        ▼
9 (npm run build) — depends on 8
        │
        ▼
10 (vercel --prod) — depends on 9
        │
        ▼
11 (final checkpoint) — depends on 10
```

Tasks 4, 5, and 6 are independent and may be executed in any order or in parallel; they all gate on tasks 1-3 having been completed and on having access to the failing exploration tests.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"],
      "dependsOn": [],
      "description": "Set up test infrastructure (Vitest + fast-check)"
    },
    {
      "wave": 2,
      "tasks": ["2", "3"],
      "dependsOn": ["1"],
      "description": "Write exploration tests (must FAIL pre-fix) and preservation tests (must PASS pre-fix); runnable in parallel"
    },
    {
      "wave": 3,
      "tasks": ["4", "5", "6", "7"],
      "dependsOn": ["2", "3"],
      "description": "Apply fixes (Bug 1 cache invalidation, Bug 2a sizes syntax, Bug 2b upload compression) and verify next.config; independent and parallelizable. Task 7 logically follows task 5 but does not block it."
    },
    {
      "wave": 4,
      "tasks": ["8"],
      "dependsOn": ["4", "5", "6"],
      "description": "Verify all property tests pass after the fix"
    },
    {
      "wave": 5,
      "tasks": ["9"],
      "dependsOn": ["8"],
      "description": "Build verification (npm run build)"
    },
    {
      "wave": 6,
      "tasks": ["10"],
      "dependsOn": ["9"],
      "description": "Deploy to Vercel production (vercel --prod)"
    },
    {
      "wave": 7,
      "tasks": ["11"],
      "dependsOn": ["10"],
      "description": "Final checkpoint — confirm all tests and build still green"
    }
  ]
}
```

## Tasks

- [x] 1. Set up test infrastructure (Vitest + fast-check)
  - The repo currently has no test runner; add one before writing tests.
  - Install `vitest`, `@vitest/ui`, `jsdom`, and `fast-check` as devDependencies (`npm install -D vitest @vitest/ui jsdom fast-check`).
  - Add `"test": "vitest --run"` and `"test:watch": "vitest"` scripts to `package.json`.
  - Create `vitest.config.ts` with `environment: 'jsdom'`, `globals: true`, and the `@/` alias mapped to the project root.
  - Add a `tests/` directory at repo root for property tests; create `tests/setup.ts` if any global setup is needed (e.g. a `Canvas` polyfill for jsdom).
  - Verify `npm run test` reports "no test files found" (or similar) without crashing.
  - _Requirements: prerequisite for tasks 2-3_

- [x] 2. Write bug condition exploration tests (Bug 1 + Bug 2a + Bug 2b)
  - **Property 1: Bug Condition** - Catalog Bugs (Stale Home Grid + Invalid `sizes` + Oversized Uploads)
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist.
  - **DO NOT attempt to fix the test or the code when it fails** in this task.
  - **NOTE**: These tests encode the expected post-fix behavior; they will validate the fix when they pass after implementation.
  - **GOAL**: Surface concrete counterexamples that demonstrate each bug.
  - **Scoped PBT Approach**: For deterministic defects (sizes-syntax, missing helper, missing `revalidatePath` call), scope properties to enumerating the concrete failing cases for reproducibility.
  - Create `tests/properties/sizes-syntax.test.ts`:
    - Use a small static-source helper (e.g. read the file with `fs.readFileSync`, regex-extract every `sizes="…"` literal under JSX `<Image …/>` in `app/page.tsx` and `app/p/[id]/ProductGallery.tsx`).
    - Use `fast-check.assert` over the array of extracted strings to assert `isValidCssSizesSyntax(s) === true` where the predicate is `^(\s*\((min|max)-(width|height):\s*\d+(px|em|rem)\)\s+\S+\s*,\s*)*\s*\S+\s*$`.
    - Expected failures (counterexamples): `(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw` and `(max-w-640px) 100vw, 640px`.
  - Create `tests/properties/compress-image.test.ts`:
    - Import `compressImage` from `lib/compressImage` (will not exist yet — import failure is a counterexample).
    - Use `fast-check` to generate `width ∈ [100, 4000]`, `height ∈ [100, 4000]`, build a synthetic `File` (e.g. via `OffscreenCanvas` or a fixture buffer), and assert: `output.size ≤ input.size` and decoded long edge `≤ 1600`.
  - Create `tests/properties/revalidate-on-create.test.ts`:
    - Mock `next/cache`'s `revalidatePath` with a spy.
    - Mock `firebase/firestore`'s `addDoc` to resolve `{ id: 'fake-id' }`.
    - Call `saveProductAction(null, formData)` with valid form data.
    - Assert spy was called with `'/'` and with `'/p/[id]', 'page'`.
    - On unfixed code, the import structure and `saveProductAction` body do not call `revalidatePath`, so the assertion fails.
  - Run `npm run test`.
  - **EXPECTED OUTCOME**: All three tests FAIL (this confirms the bugs exist).
  - Document the counterexamples observed in a comment block at the top of each test file.
  - Mark this task complete when the three tests are written, run, and their failures are documented.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Image Render Pipeline & Admin Form Outputs Unchanged Outside Buggy Inputs
  - **IMPORTANT**: Follow observation-first methodology — observe the current outputs on UNFIXED code, then encode them as properties the fixed code must continue to satisfy.
  - Observe on unfixed code:
    - `<Image>` props on every usage (`src`, `alt`, `fill`, `priority`, `className`) other than the buggy `sizes` string.
    - Firestore document fields produced by the admin form: `{ name, description, price, imageUrls, createdAt }` (no extras).
    - Share link format `${origin}/p/<id>`.
    - `compressImage` does not yet exist, so its preservation property is "for inputs already ≤ 1600 px on long edge AND ≤ 500 KB, output equals input" — written as a future expectation (will be runnable after task 6).
  - Create `tests/properties/preservation.test.ts`:
    - Property A — `<Image>` non-sizes prop preservation: parse all `<Image>` usages from `app/page.tsx` and `app/p/[id]/ProductGallery.tsx` before and after the fix; assert every prop except `sizes` is byte-identical. (Snapshot the "before" set into a fixture committed alongside the test for diffing post-fix.)
    - Property B — Firestore doc shape: with `fast-check` arbitrary `name`, `description`, `price`, `imageUrls[]`, the call to `saveProductAction` (mocked Firestore) writes exactly `{ name, description, price: priceOrNull, imageUrls, createdAt: ISOString }`.
    - Property C — Share link: with `fast-check` arbitrary `id` strings, the success-modal helper produces `${origin}/p/${id}` byte-identical to the unfixed implementation's output.
    - Property D — Already-small upload pass-through: `compressImage` on a synthetic 200 KB / 800 px input has `output.size ≤ input.size` and same decoded dimensions. (This will fail to run until task 6 lands; mark with `it.skip` and a comment, then unskip in task 8.3.)
  - Run `npm run test`.
  - **EXPECTED OUTCOME**: Properties A, B, C PASS on UNFIXED code (confirms baseline behavior to preserve). Property D is skipped pending task 6.
  - Mark this task complete when properties A-C pass on unfixed code and D is skipped with a clear comment.
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7_

- [ ] 4. Fix Bug 1 — invalidate caches via server action

  - [x] 4.1 Extend `app/admin/actions.ts` to call `revalidatePath`
    - Import `revalidatePath` from `next/cache`.
    - After the successful `addDoc`, call `revalidatePath('/')` and `revalidatePath('/p/[id]', 'page')` (the `'page'` type is required for dynamic-segment paths per the Next 16 docs).
    - Keep the same `{ success, id }` / `{ success, error }` return shape; do not change the function signature.
    - _Bug_Condition: isBug1Condition(event) — addDoc succeeded AND home cache not yet invalidated_
    - _Expected_Behavior: Property 1 from design — revalidatePath observed to be called with both arguments_
    - _Preservation: Section 3.3 (Firestore doc shape, success modal flow) and 3.7 (OG metadata) of bugfix.md_
    - _Requirements: 2.1, 3.3_

  - [x] 4.2 Switch `app/admin/page.tsx` `handleSubmit` to call the server action
    - Build a `FormData` with `name`, `description`, `price`, and `JSON.stringify(imageUrls)`.
    - Replace the inline `addDoc` call with `await saveProductAction(null, formData)`.
    - Drive `setCreatedId` / `setShowSuccessModal` from the action's return value; surface `result.error` via `setSubmitError` on failure.
    - Keep `uploadBytesResumable` and the per-file progress UI in the Client Component — image uploads from the browser remain the simplest authenticated path.
    - _Bug_Condition: isBug1Condition(event)_
    - _Expected_Behavior: Property 1 from design_
    - _Preservation: Section 3.3 (upload progress, success modal, share link), 3.4 (auth gating)_
    - _Requirements: 2.1, 3.3, 3.4_

- [ ] 5. Fix Bug 2a — repair `sizes` syntax on every `<Image>`

  - [x] 5.1 Fix `sizes` in `app/page.tsx`
    - Replace `sizes="(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"` with `sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"`.
    - Leave `export const revalidate = 60` and every other prop on the `<Image>` unchanged.
    - _Bug_Condition: isBug2aCondition(image) on app/page.tsx_
    - _Expected_Behavior: Property 3 from design — sizes parses as valid CSS_
    - _Preservation: Section 3.2 (DOM unchanged), 3.6 (other Image props unchanged)_
    - _Requirements: 2.2, 3.2, 3.6_

  - [x] 5.2 Fix `sizes` in `app/p/[id]/ProductGallery.tsx`
    - Replace `sizes="(max-w-640px) 100vw, 640px"` with `sizes="(max-width: 640px) 100vw, 640px"` on the main image.
    - Leave the thumbnail's `sizes="80px"` alone (already valid).
    - Leave `priority`, `fill`, `alt`, and `className` unchanged.
    - _Bug_Condition: isBug2aCondition(image) on app/p/[id]/ProductGallery.tsx_
    - _Expected_Behavior: Property 3 from design_
    - _Preservation: Section 3.2, 3.6_
    - _Requirements: 2.3, 3.2, 3.6_

- [ ] 6. Fix Bug 2b — client-side resize and compress before upload

  - [x] 6.1 Implement `compressImage` helper
    - Create `lib/compressImage.ts` exporting `async function compressImage(file: File): Promise<Blob>`.
    - Behavior:
      - If `file.type` is not an image, return `file` unchanged.
      - Decode via `createImageBitmap(file)` (fallback `<img>` + `URL.createObjectURL` if unavailable).
      - Compute `longEdge = max(width, height)`.
      - If `longEdge ≤ 1600` AND `file.size ≤ 500_000`, return `file` unchanged (preserves Section 3.5).
      - Otherwise compute `scale = 1600 / longEdge`, draw onto an off-screen `<canvas>` at `width * scale × height * scale`, and call `canvas.toBlob(callback, mimeType, 0.82)`.
      - Choose `mimeType`: probe `canvas.toBlob` support for `'image/webp'` once and cache the result; fall back to `'image/jpeg'`.
      - Resolve with the resulting `Blob`; reject on decode/encode error.
    - Keep the helper SSR-safe by guarding `typeof window !== 'undefined'` checks; the helper is only ever called from the client.
    - _Bug_Condition: isBug2bCondition(upload) — long edge > 1600 OR size > 500 KB_
    - _Expected_Behavior: Property 4 from design — output long edge ≤ 1600 AND output.size ≤ input.size_
    - _Preservation: Section 3.5 (small inputs unchanged)_
    - _Requirements: 2.4, 3.5_

  - [x] 6.2 Wire `compressImage` into `handleFileChange`
    - In `app/admin/page.tsx`, before constructing the `storageRef`, call `const compressed = await compressImage(file)`.
    - Pass `compressed` to `uploadBytesResumable(storageRef, compressed)` instead of the raw `file`.
    - Preserve filename traceability by keeping the storage path as `products/${Date.now()}_${file.name}`.
    - Preserve all progress reporting, error handling, and `getDownloadURL` flow exactly as today.
    - _Bug_Condition: isBug2bCondition(upload)_
    - _Expected_Behavior: Property 4 from design_
    - _Preservation: Section 3.3 (Firebase Storage path scheme, upload progress, getDownloadURL flow), 3.5 (small inputs)_
    - _Requirements: 2.4, 3.3, 3.5_

- [x] 7. Verify `next.config.ts` image config is sufficient
  - Confirm Next 16 default `images.formats` includes `image/avif` and `image/webp` (no override needed in `next.config.ts`).
  - Confirm `remotePatterns` already covers `firebasestorage.googleapis.com` and `*.firebasestorage.app` (already true).
  - Document the verification in a one-line code comment if any change is made; otherwise no edit.
  - _Bug_Condition: none — verification only_
  - _Preservation: Section 3.6 (next/image rendering unchanged)_
  - _Requirements: 2.2, 2.3_

- [ ] 8. Verify all property tests pass after the fix

  - [ ] 8.1 Verify Bug 1 / Bug 2a / Bug 2b exploration tests now pass
    - **Property 1: Expected Behavior** - Catalog Bugs Resolved
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests.
    - Run `npm run test -- tests/properties/sizes-syntax.test.ts tests/properties/compress-image.test.ts tests/properties/revalidate-on-create.test.ts`.
    - **EXPECTED OUTCOME**: All three tests PASS (confirms each bug is fixed).
    - _Requirements: Property 1, 3, 4 from design_

  - [ ] 8.2 Verify preservation properties A-C still pass
    - **Property 2: Preservation** - Render Pipeline & Admin Form Outputs Preserved
    - **IMPORTANT**: Re-run the SAME tests from task 3.
    - Run `npm run test -- tests/properties/preservation.test.ts` and confirm A, B, C still pass (no regressions).

  - [ ] 8.3 Unskip preservation Property D and verify
    - **Property 2: Preservation** - Already-Small Upload Pass-Through
    - In `tests/properties/preservation.test.ts`, change `it.skip` → `it` for Property D (already-small upload pass-through).
    - Run `npm run test`.
    - **EXPECTED OUTCOME**: Property D PASSES (small inputs flow through `compressImage` unmodified).

- [x] 9. Build verification
  - Run `npm run build` from `f:\prdocut\catalog-app`.
  - **EXPECTED OUTCOME**: Build succeeds with zero TypeScript errors and zero ESLint errors. The `/p/[id]` and `/admin` routes still appear in the output; `/` is still listed as ISR.
  - If the build fails, fix the offending source files (do not silence errors). Re-run until clean.

- [x] 10. Deploy to Vercel production
  - From `f:\prdocut\catalog-app`, run `npx vercel --prod` (uses the linked project `catalog-app` / `prj_N1D59xOUFuFM9lAEQv8dcFpV1443` per `.vercel/project.json`).
  - Wait for the deployment to report "Production".
  - Manual smoke test against `https://catalog-app-iota-green.vercel.app`:
    1. Sign in to `/admin`, create a product with one image.
    2. Open `/` on the same device — new product visible.
    3. Open `/` in a private window — new product visible.
    4. Open `/p/<id>` on a phone — hero image renders within a couple of seconds; DevTools network panel shows the picked srcset variant ≤ 750w on a 1080px-wide viewport, payload ≤ a few hundred KB.
  - If any of the four smoke checks fails, return to the relevant fix task (4 / 5 / 6) and ask the user before proceeding.
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 11. Checkpoint — Ensure all tests pass
  - Run `npm run test` one last time and confirm every property and unit test reports green.
  - Ensure `npm run build` is still clean.
  - Ask the user if any questions arise from the smoke test or if the home page or product page does not behave as expected after deploy.

## Notes

- This spec deliberately does NOT add `placeholder="blur"` to images — generating blurDataURLs for remote Firebase Storage URLs requires server-side processing and would balloon the scope.
- This spec deliberately does NOT change `/p/[id]` rendering mode. Bug 2 is about image bytes, not HTML latency.
- The fix for Bug 1 keeps the home page on ISR (`export const revalidate = 60`). We invalidate the cache on writes via `revalidatePath` rather than switching to `force-dynamic`, which preserves home-page latency for anonymous traffic — typically 95%+ of visits.
- `revalidatePath('/p/[id]', 'page')` invalidates every product detail page. This is broader than strictly necessary (only the new id needs revalidation) but it's the simplest correct call. If detail-page traffic grows, consider switching to `revalidateTag` with per-product tags.
- The `compressImage` helper does not exist yet; it is created in task 6.1. Property D in `tests/properties/preservation.test.ts` is intentionally skipped until then so task 3 can complete on unfixed code.
- The deploy step uses `npx vercel --prod` rather than relying on a Git push so the user can ship from the workspace without committing first. If the user prefers a Git-driven deploy, swap task 10 for `git push` to the production-tracking branch.
