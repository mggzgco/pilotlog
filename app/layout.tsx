import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Flight Training Super App",
  description: "Flight tracking, logbook, and cost management.",
  applicationName: "PilotLog",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PilotLog",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.svg", sizes: "180x180" }]
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
