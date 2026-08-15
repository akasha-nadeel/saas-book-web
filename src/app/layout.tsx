import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  Plus_Jakarta_Sans,
  Poppins,
} from "next/font/google";
import "./globals.css";
import { LibrarySync } from "@/components/library-sync";
import { ThemeSync } from "@/components/theme/theme-sync";

/**
 * Sets the theme on `<html>` before the first paint, so a writer who is on the
 * light theme never sees a black flash on load — or the other way round, which
 * at night is the one that hurts.
 *
 * It runs before React hydrates, so it cannot import `library-store`: it reads
 * the same key that module writes, resolves "system" against the media query
 * itself, and falls back to dark on anything unexpected — dark being what the
 * server-rendered markup is already painted in. `ThemeSync` takes over the
 * moment React is running.
 */
const THEME_BOOTSTRAP = `try{var t=JSON.parse(localStorage.getItem('openchapter:prefs')||'{}').theme;if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}`;

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
  description:
    "A calm, focused place to write your novel — chapter by chapter.",
};

// The app shell is fixed-height and manages its own scrolling, so lock the page
// to the device width and let the panels handle overflow. themeColor follows the
// scheme, so the mobile browser chrome matches the app rather than flashing.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The mobile browser's own chrome. Answered per scheme rather than once,
  // because this is read from the markup before any of our script runs — it
  // cannot know what the writer chose, only what their machine prefers, and
  // being right for the two who never change it beats being wrong for both.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the bootstrap below writes data-theme onto this
    // element before hydration, and the server markup does not carry it.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${poppins.variable} ${jakarta.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/*
        Stays a bare <script> in <head>, deliberately.

        React 19 logs "Encountered a script tag while rendering React component"
        for this in development. That warning is about client-rendered scripts
        never executing, which is true and irrelevant here: this one runs from
        the server's HTML during parse, which is the only moment it is any use,
        and it is the whole reason nobody sees the wrong theme flash.

        `next/script` at beforeInteractive was tried and is wrong: it cannot be
        a direct child of <html>, and moving it into <body> gives up the one
        guarantee that matters — running before the first paint. The dev console
        message is cosmetic; the flash would not be.
      */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      {/* Only the shell. The chapter sidebar lives in the book layout, so the
          shelf can render full-width without one. */}
      <body className="h-full overflow-hidden bg-surface text-fg">
        <ThemeSync />
        <LibrarySync />
        {/* `AppLoader` stood here and is gone, at the owner's request. It held
            the loading screen up for a second on every route but `/` so the
            logo's fill animation had time to play — a delay the product
            invented and a writer paid for. `LoadingScreen` still renders
            wherever a screen genuinely has nothing yet; it is a spinner now
            rather than a mark, so there is nothing left that needs holding. */}
        {children}
      </body>
    </html>
  );
}
