import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shina Keyboard",
  description: "Shina Keyboard by Younis Majeed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ur">
      <body>{children}</body>
    </html>
  );
}
