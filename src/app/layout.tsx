import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ChapterSidebar } from "@/components/sidebar/chapter-sidebar";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenChapter",
  description: "A calm, focused place to write your novel — chapter by chapter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      {/* The shell itself never scrolls: the sidebar stays put and the
          manuscript column scrolls inside it, which is what keeps the chapter
          list reachable from the bottom of a long chapter. */}
      <body className="flex h-full overflow-hidden bg-cream text-ink">
        <ChapterSidebar />
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </body>
    </html>
  );
}
