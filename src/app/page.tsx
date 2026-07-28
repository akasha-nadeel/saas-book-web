import { Bookshelf } from "@/components/shelf/bookshelf";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Reading the writer here rather than inside the shelf keeps the account chip
 * right on the very first paint — a client-side lookup would show a guest for a
 * frame and then correct itself. getClaims verifies the JWT signature rather
 * than trusting the cookie, which is what makes this safe to render from.
 */
export default async function Home() {
  let email: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    email = data?.claims.email ?? null;
  }

  return <Bookshelf email={email} />;
}
