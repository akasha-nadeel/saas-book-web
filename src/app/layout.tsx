import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/theme/theme-sync";
import { AppLoader } from "@/components/app-loader";

/**
 * Sets the theme on <html> before the first paint, so a writer who chose dark
 * never sees a white flash on load. It runs before React hydrates, so it cannot
 * import library-store; it reads the same key that module writes and defaults to
 * light on anything unexpected. ThemeSync takes over once React is running.
 */
const THEME_BOOTSTRAP = `try{var t=JSON.parse(localStorage.getItem('openchapter:prefs')||'{}').theme;document.documentElement.dataset.theme=t==='dark'?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}`;

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

// The wordmark only. A geometric sans with circular bowls reads as a mark
// rather than as more interface text.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenChapter",
  description: "A calm, focused place to write your novel — chapter by chapter.",
};

// The app shell is fixed-height and manages its own scrolling, so lock the page
// to the device width and let the panels handle overflow. themeColor follows the
// scheme, so the mobile browser chrome matches the app rather than flashing.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#121821" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the bootstrap script writes data-theme onto this
    // element before hydration, which the server markup does not carry.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      {/* Only the shell. The chapter sidebar lives in the book layout, so the
          shelf can render full-width without one. */}
      <body className="h-full overflow-hidden bg-surface text-fg">
        <ThemeSync />
        <AppLoader />
        {children}
      </body>
    </html>
  );
}
