// Global test setup for Vitest + jsdom.
//
// jsdom does not implement the full Canvas API. Tests that exercise
// `compressImage` will need a Canvas-capable environment; for now we install
// minimal no-op shims so importing modules that touch <canvas> in module
// scope does not crash. Tests that need real image decoding can polyfill
// further (e.g. via `canvas` package) inside the test file itself.

if (typeof HTMLCanvasElement !== 'undefined') {
  if (!HTMLCanvasElement.prototype.toBlob) {
    HTMLCanvasElement.prototype.toBlob = function toBlob(
      callback: BlobCallback,
    ) {
      callback(null);
    };
  }
}
