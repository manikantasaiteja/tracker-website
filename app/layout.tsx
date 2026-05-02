import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trackr",
  description: "Track your job search with a Supabase-backed dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
