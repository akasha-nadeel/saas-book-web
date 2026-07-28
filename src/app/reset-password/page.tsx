import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Set a new password · OpenChapter",
};

/**
 * Only reachable with a session — the recovery link established one on its way
 * through /auth/confirm, and the proxy turns anyone else away. Naming the
 * account here is what tells a writer the link landed on the right one.
 */
export default async function ResetPasswordPage() {
  let email: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    email = data?.claims.email ?? null;
  }

  return <ResetPasswordForm email={email} />;
}
