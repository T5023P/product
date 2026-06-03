import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Top Securities Catalog",
    short_name: "TopCatalog",
    start_url: "/",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#1E3A8A",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
