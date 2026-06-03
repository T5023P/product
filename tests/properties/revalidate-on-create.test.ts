/**
 * Bug Condition Exploration Test — Bug 1: stale home grid because
 * `saveProductAction` does not call `revalidatePath` after a successful
 * `addDoc`.
 *
 * **Validates: Requirements 1.1 (bugfix.md current behavior),
 *  Property 1 (design.md correctness property).**
 *
 * GOAL: Surface a counterexample that demonstrates the missing cache
 * invalidation. We mock `next/cache`'s `revalidatePath` with a spy and
 * mock `firebase/firestore`'s `addDoc` to resolve `{ id: 'fake-id' }`,
 * then call `saveProductAction(null, formData)` with valid form data and
 * assert the spy received both required calls.
 *
 * EXPECTED OUTCOME ON UNFIXED CODE: this test FAILS — the spy is never
 * called because `app/admin/actions.ts` does not import or invoke
 * `revalidatePath`.
 *
 * Documented counterexample (observed on unfixed source):
 *  - `app/admin/actions.ts` imports only `addDoc` and `collection` from
 *    `firebase/firestore` plus `db` from `lib/firebase` — there is no
 *    `revalidatePath` import and no call site.
 *  - Therefore: `revalidatePathSpy.mock.calls` is empty after
 *    `saveProductAction` returns successfully.
 *
 * NOTE (per spec): we deliberately do NOT attempt to fix the test or the
 * server action here — that is task 4.1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock `next/cache` --------------------------------------------------
const revalidatePathSpy = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathSpy(...args),
}));

// --- Mock `firebase/firestore` -----------------------------------------
// `addDoc` resolves to `{ id: 'fake-id' }`; `collection` is a passthrough
// that returns a marker so `addDoc(collection(db, 'products'), …)` works.
vi.mock('firebase/firestore', () => ({
  collection: (..._args: unknown[]) => ({ __collection: true }),
  addDoc: vi.fn(async () => ({ id: 'fake-id' })),
}));

// --- Mock `lib/firebase` to avoid Firebase app initialization ----------
vi.mock('../../lib/firebase', () => ({
  db: { __db: true },
}));

beforeEach(() => {
  revalidatePathSpy.mockClear();
});

describe('Bug 1: `saveProductAction` must invalidate the home & product page caches via `revalidatePath`', () => {
  it('calls `revalidatePath("/")` and `revalidatePath("/p/[id]", "page")` after a successful `addDoc`', async () => {
    // Import lazily so the mocks are installed first.
    const { saveProductAction } = await import('../../app/admin/actions');

    const formData = new FormData();
    formData.set('name', 'Ceramic Vase');
    formData.set('description', 'A handcrafted minimalist vase.');
    formData.set('price', '49.99');
    formData.set(
      'imageUrls',
      JSON.stringify(['https://example.com/img1.jpg']),
    );

    const result = await saveProductAction(null, formData);

    // Sanity: the action reports success and surfaces the fake doc id.
    expect(result).toEqual({ success: true, id: 'fake-id' });

    // Property 1: the home cache must be invalidated.
    expect(revalidatePathSpy).toHaveBeenCalledWith('/');

    // Property 1: the dynamic product page cache must be invalidated with
    // the `'page'` type (required for dynamic-segment paths in Next 16).
    expect(revalidatePathSpy).toHaveBeenCalledWith('/p/[id]', 'page');
  });
});
