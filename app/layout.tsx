import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
