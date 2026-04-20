import "./globals.css";
import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "700"]
});

export const metadata: Metadata = {
  title: "Kindergarten Wochenplanung",
  description: "Einfache Wochenplanung mit Supabase Realtime"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={nunito.className}>{children}</body>
    </html>
  );
}
