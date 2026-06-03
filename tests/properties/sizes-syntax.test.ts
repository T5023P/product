/**
 * Bug Condition Exploration Test — Bug 2a: invalid `sizes` attribute syntax.
 *
 * **Validates: Requirements 1.2, 1.3 (bugfix.md current behavior),
 *  Property 3 (design.md correctness property).**
 *
 * GOAL: Surface counterexamples that demonstrate the malformed `sizes`
 * attributes on every `<Image …/>` literal in `app/page.tsx` and
 * `app/p/[id]/ProductGallery.tsx`. The spec predicate is:
 *
 *   isValidCssSizesSyntax(s) ===
 *     /^(\s*\((min|max)-(width|height):\s*\d+(px|em|rem)\)\s+\S+\s*,\s*)*\s*\S+\s*$/.test(s)
 *
 * EXPECTED OUTCOME ON UNFIXED CODE: this test FAILS — failure proves the
 * bug exists.
 *
 * Documented counterexamples (observed on unfixed source):
 *  - app/page.tsx:                "(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"
 *  - app/p/[id]/ProductGallery.tsx: "(max-w-640px) 100vw, 640px"
 *
 * Both fail because `max-w-768px` / `max-w-1200px` / `max-w-640px` are
 * Tailwind-style class names, not valid CSS media features.
 *
 * NOTE (per spec): the "scoped PBT approach" runs `fast-check.assert` over
 * the array of extracted strings. We deliberately do NOT attempt to fix
 * either the test or the source when this test fails — that is task 5.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import fs from 'node:fs';
import path from 'node:path';

const SIZES_REGEX =
  /^(\s*\((min|max)-(width|height):\s*\d+(px|em|rem)\)\s+\S+\s*,\s*)*\s*\S+\s*$/;

function isValidCssSizesSyntax(s: string): boolean {
  return SIZES_REGEX.test(s);
}

/**
 * Static-source helper: read each file with `fs.readFileSync` and regex-extract
 * every `sizes="…"` literal occurring inside JSX `<Image …/>`.
 */
function extractSizesLiteralsFromImageJsx(absFile: string): string[] {
  const source = fs.readFileSync(absFile, 'utf8');
  const results: string[] = [];

  // Match `<Image …/>` blocks (including multi-line, self-closing or with
  // children — we only care about the opening tag's attributes).
  const imageTagRegex = /<Image\b[^>]*?>/gs;
  const tagMatches = source.match(imageTagRegex) ?? [];

  for (const tag of tagMatches) {
    // Within the tag body, find every `sizes="…"` literal.
    const sizesAttrRegex = /\bsizes\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = sizesAttrRegex.exec(tag)) !== null) {
      results.push(m[1]);
    }
  }
  return results;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TARGET_FILES = [
  path.join(PROJECT_ROOT, 'app', 'page.tsx'),
  path.join(PROJECT_ROOT, 'app', 'p', '[id]', 'ProductGallery.tsx'),
];

describe('Bug 2a: every `<Image>` `sizes` literal must use valid CSS media-query syntax', () => {
  it('predicate sanity check — known good vs known bad inputs', () => {
    expect(isValidCssSizesSyntax('(max-width: 768px) 100vw, 33vw')).toBe(true);
    expect(
      isValidCssSizesSyntax(
        '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
      ),
    ).toBe(true);
    expect(isValidCssSizesSyntax('80px')).toBe(true);
    expect(isValidCssSizesSyntax('(max-width: 640px) 100vw, 640px')).toBe(true);

    // The actual bug strings — these are the counterexamples.
    expect(
      isValidCssSizesSyntax(
        '(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw',
      ),
    ).toBe(false);
    expect(isValidCssSizesSyntax('(max-w-640px) 100vw, 640px')).toBe(false);
  });

  it('every extracted `sizes` literal in `<Image>` JSX is valid CSS sizes syntax', () => {
    const allLiterals = TARGET_FILES.flatMap((file) => {
      const literals = extractSizesLiteralsFromImageJsx(file);
      return literals.map((s) => ({ file, s }));
    });

    // Sanity: we must actually be reading the files we expect to inspect.
    expect(allLiterals.length).toBeGreaterThan(0);

    // Scoped PBT: enumerate over the extracted literals.
    fc.assert(
      fc.property(fc.constantFrom(...allLiterals), ({ file, s }) => {
        if (!isValidCssSizesSyntax(s)) {
          throw new Error(
            `Invalid CSS \`sizes\` syntax in ${path.relative(
              PROJECT_ROOT,
              file,
            )}: ${JSON.stringify(s)}`,
          );
        }
      }),
      // Every literal needs to be checked, so make the run count match.
      { numRuns: Math.max(allLiterals.length, 5) },
    );
  });
});
