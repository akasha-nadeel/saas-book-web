import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/**
 * The Supabase client for code running in the browser.
 *
 * `createBrowserClient` keeps its own singleton per origin, so calling this on
 * every render is free — there is no need to memoise it, and doing so would
 * only risk holding a stale client across a sign-out.
 *
 * Guard with `isSupabaseConfigured()` before calling: with no project set the
 * constructor throws, which is the right behaviour for a programming error but
 * not something a writer should ever see.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
