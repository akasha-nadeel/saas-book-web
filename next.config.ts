import type { NextConfig } from "next";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

/**
 * Paged.js, resolved to the build that survives bundling.
 *
 * Its `exports` map sends `import` at `src/index.js` — the unbundled ES source,
 * which pulls in `event-emitter` and the `es5-ext` shims underneath it. Those
 * are old CommonJS packages that reach for things like
 * `es5-ext/string/#/contains` and call `.call` on the result; bundled, that
 * arrives as a module namespace rather than a function and Paged.js dies inside
 * `new Handlers()` with `TypeError: contains.call is not a function`. It is
 * thrown at the first `preview()`, so the failure is a PDF export that produces
 * nothing rather than anything the compiler could have caught.
 *
 * `dist/paged.esm.js` is the same library with all of that already resolved and
 * bundled, and it is what Paged.js ships for browsers. It cannot be imported by
 * path — the `exports` map has no wildcard, so a deep import is refused — hence
 * the alias, which is the only place that knows about any of this.
 *
 * Found from the package's own entry point rather than from a hand-written
 * path, so a hoisted or nested `node_modules` resolves either way — and *via*
 * the entry rather than by asking for the file directly, because the same
 * `exports` map refuses `require.resolve("pagedjs/dist/paged.esm.js")` with
 * ERR_PACKAGE_PATH_NOT_EXPORTED. Both entry points it does expose (`src/` and
 * `lib/`) sit one level under the package root, so `../dist` is the same
 * journey from either.
 *
 * Checked rather than assumed: if a future version moves that file, this throws
 * at boot with a sentence saying what happened. The alternative is an alias
 * quietly pointing at nothing, which shows up as a PDF export that fails at the
 * press with no clue why.
 */
const pagedjsFile = resolve(
  dirname(createRequire(import.meta.url).resolve("pagedjs")),
  "../dist/paged.esm.js",
);

/* Turbopack wants a path it can treat as a request, not a bare absolute one:
   given `D:\…\paged.esm.js` it reports "Module not found" for the very file
   that is sitting there. Project-relative with forward slashes is the form it
   takes, and webpack is happy with either. */
const pagedjs = `./${relative(process.cwd(), pagedjsFile).split(sep).join("/")}`;

if (!existsSync(pagedjsFile)) {
  throw new Error(
    `Paged.js's bundled build is not at ${pagedjs}. The print export aliases ` +
      `'pagedjs' to it because the package's own ESM entry cannot be bundled ` +
      `(see the note above). Check what dist/ ships in the installed version.`,
  );
}

/**
 * The same `dist/` again, for the server that renders the PDF.
 *
 * `/api/export/pdf` injects `paged.polyfill.js` into a headless browser as
 * source text, so it needs the file rather than the module — and it cannot ask
 * for it by specifier for the reason spelled out above: the `exports` map has
 * no path entries, so the bundler refuses `pagedjs/dist/…` outright. Resolved
 * here, where `createRequire` is a build-time thing and hoisting is already
 * being handled, and handed over as a path the route reads at runtime.
 */
const pagedjsDist = dirname(pagedjsFile);

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: { pagedjs },
  },

  /* Where the route finds the polyfill. Inlined at build time, so it survives
     into the server bundle without the route resolving anything itself. */
  env: {
    OC_PAGEDJS_DIST: pagedjsDist,
  },

  /**
   * The polyfill, packed into the deployed function.
   *
   * Nothing imports it — the route reads it off disk as text — and a tracer
   * only packs what it can see, so without this the file is simply absent in
   * production and every PDF export falls back to the print dialog. Named
   * against the route that reads it rather than globally.
   */
  outputFileTracingIncludes: {
    "/api/export/pdf": ["./node_modules/pagedjs/dist/paged.polyfill.js"],
  },
  /* No `webpack` hook beside this. Next 16 builds with Turbopack, and adding a
     webpack config to a Turbopack project changes how the whole graph is
     resolved rather than merely adding an alias to a second bundler — with one
     here, `/read`, `/chapter/[chapterId]` and `/roadmap` all began answering
     404 while every other route was fine. The alias above is enough. */

  /**
   * The dev-tools badge, out of the sidebar's corner.
   *
   * It sits bottom-left by default, which is exactly where the account row at
   * the foot of the dashboard rail is — so it covered it. The rail had been
   * carrying `pb-14` to duck under it, which meant a hand's width of dead space
   * at the bottom of the *shipped* product to accommodate something only the
   * person building it can see. Moving the badge is the fix; padding was the
   * workaround.
   */
  devIndicators: {
    position: "bottom-right",
  },

  images: {
    /**
     * The qualities `next/image` is allowed to serve, and **this list is
     * required in Next 16** — it defaults to `[75]`, and anything else is
     * refused rather than honoured.
     *
     * That default is what makes it worth a note. A `quality={95}` on a
     * component does not error and does not warn: the optimizer falls back to
     * the closest allowed value, which with a one-entry list is always 75. So
     * the landing page's photographs were re-encoded at 75 on the way out no
     * matter what the call site asked for, which is two lossy passes over a
     * picture of small type — the content webp's default tuning handles worst.
     * The only way to see it is to request the REST endpoint by hand
     * (`/_next/image?url=…&q=95`), which answers **400** rather than the image.
     *
     * 95 is here for the four figures in "The order", where the whole claim is
     * that a reader can read the app's own type in the picture. 75 stays
     * because it is the default every other `<Image>` on the site uses and
     * dropping it would re-encode all of them. Add a value here only with a
     * call site that needs it — each one is another variant the optimizer can
     * be asked to generate and cache.
     */
    qualities: [75, 95],
  },
};

export default nextConfig;
