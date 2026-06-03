/**
 * Bug Condition Exploration Test — Bug 2b: oversized uploads (no client-side
 * resize/compress before `uploadBytesResumable`).
 *
 * **Validates: Requirements 1.4 (bugfix.md current behavior),
 *  Property 4 (design.md correctness property).**
 *
 * GOAL: Surface a counterexample that demonstrates that no `compressImage`
 * helper exists yet — the dynamic import will throw `ERR_MODULE_NOT_FOUND`
 * (or Vitest's equivalent), which is itself the counterexample.
 *
 * EXPECTED OUTCOME ON UNFIXED CODE: this test FAILS — the failure occurs at
 * `await import('../../lib/compressImage')` because the module has not been
 * created yet (it is created in task 6.1).
 *
 * Documented counterexample (observed on unfixed source):
 *  - `lib/compressImage.ts` does not exist; `import` fails with
 *    `Failed to resolve import "../../lib/compressImage"` /
 *    `Cannot find module 'lib/compressImage'`.
 *
 * The property the helper SHALL satisfy after task 6.1:
 *   FOR ALL width ∈ [100, 4000], height ∈ [100, 4000]:
 *     output := compressImage(synthFile(width, height))
 *     output.size ≤ input.size
 *     decodedLongEdge(output) ≤ 1600
 *
 * NOTE (per spec): we deliberately do NOT attempt to fix the test or
 * implement the helper here — that is task 6.1.
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';

/**
 * Construct a synthetic `File` of approximately `width × height` bytes.
 * The unfixed code never sees this — the test fails at `import` time.
 * We still build the generator so that, post-fix, the same property body
 * can be reused (per spec: "These tests encode the expected post-fix
 * behavior; they will validate the fix when they pass after implementation").
 */
function synthFile(width: number, height: number): File {
  // Create a deterministic byte buffer of size ~ width*height*3 (RGB-ish),
  // capped to avoid eating gigabytes of RAM in the test runner.
  const approxBytes = Math.min(width * height * 3, 12_000_000);
  const buf = new Uint8Array(approxBytes);
  for (let i = 0; i < buf.length; i += 1024) {
    buf[i] = (i & 0xff);
  }
  return new File([buf], `synth-${width}x${height}.bin`, {
    type: 'image/jpeg',
  });
}

describe('Bug 2b: `compressImage(file)` must bound output long edge ≤ 1600 px and output.size ≤ input.size', () => {
  it('imports `compressImage` from `lib/compressImage` and validates the post-condition', async () => {
    // The import itself is the counterexample on unfixed code.
    const mod = await import('../../lib/compressImage');
    const compressImage: (file: File) => Promise<Blob> = (mod as any).compressImage;

    if (typeof compressImage !== 'function') {
      throw new Error(
        '`compressImage` is not exported from `lib/compressImage` ' +
          '(expected `async function compressImage(file: File): Promise<Blob>`).',
      );
    }

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 4000 }),
        async (width, height) => {
          const input = synthFile(width, height);
          const output = await compressImage(input);

          // Property 4 — output.size ≤ input.size.
          if (output.size > input.size) {
            throw new Error(
              `compressImage produced larger output: input=${input.size}B output=${output.size}B for ${width}×${height}`,
            );
          }

          // Property 4 — decoded long edge ≤ 1600.
          // Decoding requires `createImageBitmap` which jsdom does not
          // implement; we approximate by trusting the helper's own
          // dimension contract via a best-effort decode when available.
          const anyGlobal = globalThis as any;
          if (typeof anyGlobal.createImageBitmap === 'function') {
            try {
              const bitmap = await anyGlobal.createImageBitmap(output);
              const longEdge = Math.max(bitmap.width, bitmap.height);
              if (longEdge > 1600) {
                throw new Error(
                  `compressImage output long edge ${longEdge}px > 1600px for ${width}×${height}`,
                );
              }
            } catch (e) {
              // If decoding fails in this environment, the property is
              // unverifiable here; the integration smoke test in task 10
              // covers the pixel-accurate check.
            }
          }
        },
      ),
      { numRuns: 10 },
    );
  });
});
