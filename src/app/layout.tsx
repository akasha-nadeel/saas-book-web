import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  Plus_Jakarta_Sans,
  Poppins,
} from "next/font/google";
import "./globals.css";
import { ThemeSync } from "@/components/theme/theme-sync";
import { AppLoader } from "@/components/app-loader";
import { LibrarySync } from "@/components/library-sync";

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
//
// 700 is the landing page's wordmark weight. The design this page was built
// from sets that mark in Montserrat; Poppins is the same species of geometric
// sans and is already being downloaded for the app, so it stands in rather than
// pulling a third family over the wire for two words.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

/**
 * The landing page's own face, and *only* the landing page's.
 *
 * The app writes in Fraunces and Inter and should keep doing so — this is the
 * shop front, drawn to a design that is built on Plus Jakarta Sans throughout.
 * Substituting Inter here would land somewhere between the two and look like
 * neither.
 *
 * The weight list is exactly what the design uses. next/font subsets and
 * self-hosts, so this costs the marketing page and nothing else; no screen
 * behind the sign-in wall references these variables.
 */
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/** The format codes in the landing page's in/out lists (`.epub`, `.docx`). */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${fraunces.variable} ${inter.variable} ${poppins.variable} ${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/*
        Stays a bare <script> in <head>, deliberately.

        React 19 logs "Encountered a script tag while rendering React component"
        for this in development. That warning is about scripts *client*-rendered
        never executing, which is true and irrelevant here: this one runs from
        the server's HTML during parse, which is the only time it needs to, and
        it is the whole reason a dark-mode writer never sees a white flash.

        Swapping it for `next/script` at `beforeInteractive` was tried and is
        wrong: that component cannot be a direct child of <html> ("Cannot render
        a sync or defer <script> outside the main document"), and moving it into
        <body> gives up the guarantee that matters — running before first paint.
        The dev console message is cosmetic; the flash would not be.
      */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      {/* Only the shell. The chapter sidebar lives in the book layout, so the
          shelf can render full-width without one. */}
      <body className="h-full overflow-hidden bg-surface text-fg">
        <ThemeSync />
        <LibrarySync />
        <AppLoader />
        {children}
      </body>
    </html>
  );
}
