import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UDINA | Ylookup",
  description: "Unstructured Data Ingestion and Normalization Agent. The on-ramp for Ylookup's core reconciliation engine.",
  icons: {
    icon: "/ylookup_logo.jpeg",
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
