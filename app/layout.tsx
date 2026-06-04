import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOP SECURITIES",
  description:
    "Official website for TOP SECURITIES and WebMorphic digital application development.",
  metadataBase: new URL("https://topsecurities.online"),
  icons: {
    shortcut: "/favicon.svg",
    icon: "/icon",
    apple: "/apple-icon",
  },
  openGraph: {
    type: "website",
    siteName: "TOP SECURITIES",
    title: "TOP SECURITIES",
    description:
      "Official website for TOP SECURITIES and WebMorphic digital application development.",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "TOP SECURITIES",
    description:
      "Official website for TOP SECURITIES and WebMorphic digital application development.",
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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
