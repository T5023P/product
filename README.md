# Catalog App

Static-export Next.js catalog app backed by Firebase and prepared for Cloudflare Pages deployment.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The admin dashboard lives in `app/(admin)` and the public product pages live in `app/p/[id]`.

## Cloudflare deploy

This app already uses static export in `next.config.ts`, so it bypasses Vercel image optimization completely and serves Firebase Storage images directly to the browser.

1. Build the static output:

```bash
npm run build:cloudflare
```

2. Deploy the generated `out/` folder to Cloudflare Pages:

```bash
npm run deploy:cloudflare
```

3. In Cloudflare Pages, connect the repository and use:

- Build command: `npm run build:cloudflare`
- Build output directory: `out`

The Wrangler config is stored in `wrangler.toml` and uses `pages_build_output_dir = "./out"` so Cloudflare can deploy the same artifact locally or in CI.

## Notes

- Product images are loaded from Firebase Storage using regular browser image requests.
- The old `.vercel/` folder is no longer needed once Cloudflare is your active host.
- If you want Cloudflare to become the only deployment target, disconnect the Vercel project in the Vercel dashboard after verifying the Pages deployment.
