import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flight Training Super App",
  description: "Flight tracking, logbook, and cost management."
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
