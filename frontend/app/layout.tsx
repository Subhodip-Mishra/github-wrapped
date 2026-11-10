import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "GitHub Wrapped | Developer Year in Review",
  description:
    "Generate and download your personalized, high-resolution GitHub Wrapped developer card.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark font-sans">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#000000] text-[#ededed] min-h-screen selection:bg-pink-600/30 selection:text-white`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
