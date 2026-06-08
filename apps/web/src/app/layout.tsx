import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UniSi | Secure E-Signatures",
  description: "Secure digital signing and document verification for audit-ready teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
