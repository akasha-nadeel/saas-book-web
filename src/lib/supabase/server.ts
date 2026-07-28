import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * The Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * A new client per request, never shared — it carries that request's cookies,
 * and reusing one across requests would hand a session to the wrong reader.
 *
 * The `setAll` swallow is not laziness. A Server Component cannot write cookies
 * during render, so a token refresh that lands there throws; the proxy has
 * already refreshed the session for this request, so losing the write here
 * costs nothing. In a Server Action or Route Handler the same call succeeds and
 * the refreshed token is stored properly.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render. See the note above.
        }
      },
    },
  });
}
