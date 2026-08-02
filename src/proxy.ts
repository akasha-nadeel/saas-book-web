import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { safeNext } from "@/lib/auth-redirect";

/**
 * Session refresh, and the sign-in wall.
 *
 * Next calls this "Proxy" as of 16 — it is what earlier versions called
 * Middleware, and it runs before any rendering. Supabase needs it for one
 * structural reason: a Server Component cannot write cookies, so something
 * ahead of the render has to refresh an expired token and store it. Without
 * this file sessions expire mid-session and writers get logged out at random.
 *
 * The gate is deliberately coarse — signed in or not. It is an optimistic check
 * in Next's sense: cheap, and not the thing that actually protects data. What
 * protects data is row-level security in Postgres, which no request can talk
 * its way past.
 */

/**
 * Reachable without a session. Everything else redirects to /signin.
 *
 * /reset-password is deliberately *not* here: the recovery link signs the
 * writer in as it passes through /auth/confirm, so by the time they reach the
 * reset screen they have a session like anyone else. Leaving it gated is what
 * stops a stranger opening it directly.
 */
const PUBLIC_PREFIXES = ["/signin", "/signup", "/forgot-password", "/auth"];

/**
 * Matched whole, not as a prefix. "/" is the landing page for a signed-out
 * visitor and the shelf for a signed-in one — the page decides which. As a
 * prefix it would of course make the entire app public.
 *
 * "/upgrade" is public because a price is read before an account is made. It
 * holds no manuscript and no account detail — only what each plan costs.
 */
const PUBLIC_EXACT = ["/", "/upgrade"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest) {
  // No project configured means no accounts: the app runs as it always has,
  // entirely local, and nothing is gated. See lib/supabase/config.ts.
  if (!isSupabaseConfigured()) return NextResponse.next();

  // Reassigned by setAll below — a refreshed token has to travel on a response
  // built *after* the new cookies are on the request, so downstream Server
  // Components read the new session rather than the expired one.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // no-store and friends. A response carrying a Set-Cookie for an auth
        // token must never be cached by a CDN, or one writer's session is
        // handed to the next reader.
        for (const [name, value] of Object.entries(headers)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // Must run before the response is returned: a refresh that completes after
  // the response is committed cannot write its cookies, and the next request
  // refreshes again. getClaims verifies the JWT signature rather than trusting
  // the cookie, which is why it — not getSession — is what the gate reads.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = "";
    // Come back to where they were headed once they are in.
    url.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return withCookies(NextResponse.redirect(url), response);
  }

  /*
   * A signed-in writer has no use for the sign-in screen — but they may have
   * been sent to it by the rule above, and in that case they asked for
   * somewhere.
   *
   * **This dropped the destination it had just written.** An access token
   * expires roughly hourly, and the request that discovers it is the one the
   * writer made: the gate above sees no claims yet, bounces them to
   * `/signin?next=<where they were going>`, and by the time that request
   * arrives the refreshed cookie has landed — so this rule fires, sent them to
   * `/`, and the `next` was thrown away one line after being set. From the
   * writer's side a link simply stopped working and dumped them on the
   * dashboard, which is exactly the "logged out at random" failure this proxy
   * exists to prevent, wearing a different hat.
   *
   * `safeNext()` is the guard that already exists for this parameter: rooted
   * same-site paths only, so `//evil`, a protocol-relative host and anything
   * with a backslash all collapse to `/`. Anyone can put anything in a query
   * string, and this one is now acted on rather than ignored.
   */
  if (signedIn && (pathname === "/signin" || pathname === "/signup")) {
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    const url = new URL(next, request.nextUrl.origin);
    // A `next` pointing back at the door would bounce forever.
    if (url.pathname === "/signin" || url.pathname === "/signup") {
      url.pathname = "/";
      url.search = "";
    }
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

/**
 * Carries a refreshed session onto a redirect. Skipping this drops the new
 * token on exactly the requests that bounce, so the writer refreshes forever.
 */
function withCookies(target: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the API.
     *
     * The API is left out on purpose: redirecting a fetch to an HTML sign-in
     * page produces a baffling parse error rather than a 401, so routes answer
     * for themselves — see app/api/chat/route.ts.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
