import type { Metadata } from "next";
import { Fredoka, ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";

// Chunky rounded display fonts for headlines only — body copy keeps the
// existing system stack for readability. See round-table-style-guide.md §3.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-en",
  display: "swap",
});

const zcoolKuaiLe = ZCOOL_KuaiLe({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display-zh",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Round Table",
  description: "Three role-specialized agents debate your idea, then align on one recommendation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${zcoolKuaiLe.variable}`}>
      <body>{children}</body>
    </html>
  );
}
