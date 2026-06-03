/**
 * Fixture: snapshot of every `<Image>` JSX prop set observed on the
 * UNFIXED code path, keyed by `<file>#<tag-index>`.
 *
 * Used by `tests/properties/preservation.test.ts` Property A to assert
 * that, after the Bug 2a `sizes` repair, every other `<Image>` prop on
 * the same tag remains byte-identical to the values captured here.
 *
 * Captured from:
 *   - app/page.tsx                     (one <Image>, the home grid card)
 *   - app/p/[id]/ProductGallery.tsx   (two <Image>s — main + thumbnails)
 *
 * Format:
 *   - boolean shorthand attrs (e.g. `fill`, `priority`) → `true`
 *   - string-literal attrs (e.g. `sizes="…"`)          → the quoted form, e.g. `'"…"'`
 *   - JSX-expression attrs (e.g. `src={x}`)            → the brace form, e.g. `'{x}'`
 *
 * `sizes` IS captured here for completeness, but Property A explicitly
 * compares only the non-`sizes` subset — that is the field the fix is
 * allowed to rewrite (Bug 2a). Every other field MUST match.
 */
export const IMAGE_PROPS_BEFORE_FIX: Record<
  string,
  Record<string, string | true>
> = {
  'app/page.tsx#0': {
    src: '{mainImage}',
    alt: '{product.name}',
    fill: true,
    sizes: '"(max-w-768px) 100vw, (max-w-1200px) 50vw, 33vw"',
    className:
      '"object-cover object-center group-hover:scale-105 transition-transform duration-500"',
  },
  'app/p/[id]/ProductGallery.tsx#0': {
    src: '{imageUrls[activeIndex]}',
    alt: '{`${name} - View ${activeIndex + 1}`}',
    fill: true,
    priority: true,
    sizes: '"(max-w-640px) 100vw, 640px"',
    className: '"object-cover object-center transition-all duration-300"',
  },
  'app/p/[id]/ProductGallery.tsx#1': {
    src: '{url}',
    alt: '{`${name} thumbnail ${index + 1}`}',
    fill: true,
    sizes: '"80px"',
    className: '"object-cover object-center"',
  },
};
