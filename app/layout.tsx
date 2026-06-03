import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Top Securities Catalog",
  description: "Top Securities product catalog",
  metadataBase: new URL("https://www.topsecurities.online"),
  icons: {
    shortcut: "/favicon.svg",
    icon: "/icon",
    apple: "/apple-icon",
  },
  openGraph: {
    type: "website",
    siteName: "Top Securities Catalog",
    title: "Top Securities Catalog",
    description: "Top Securities product catalog",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Top Securities Catalog",
    description: "Top Securities product catalog",
    images: ["/twitter-image"],
  },
  manifest: "/manifest.webmanifest",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
