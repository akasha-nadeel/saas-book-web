"use client";

import { useEffect, useState } from "react";
import { accountFromClaims, type Account } from "@/lib/account";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

/**
 * The signed-in writer's name and face, read in the browser.
 *
 * **The shelf gets this on the server and hands it down**, which is right for
 * a screen the server renders anyway. A tool screen is a client component
 * reached by client navigation, sometimes mounted inside the roadmap's panel,
 * and threading an `Account` through `ToolPageProps` would put it on sixteen
 * signatures for the two that want a face. So this asks for itself.
 *
 * `getClaims()` rather than `getSession()`, the same rule the proxy follows:
 * it verifies the JWT's signature where the other trusts whatever is in the
 * cookie. It is an ordinary local read of an already-fetched token, not a
 * round trip.
 *
 * **Null is a real answer and the common one in development.** With no
 * Supabase project configured there are no accounts at all, and the callers
 * fall back to an initial — a face nobody misses, which is the same fallback
 * `account.ts` was written around.
 */
export function useAccount(): Account | null {
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // A component can unmount before the promise settles — a writer who opens
    // a tool and navigates straight out, which the roadmap's panel makes easy.
    let live = true;

    createClient()
      .auth.getClaims()
      .then(({ data }) => {
        if (!live || !data?.claims) return;
        setAccount(accountFromClaims(data.claims as Record<string, unknown>));
      })
      .catch(() => {
        // A face is decoration. A screen that failed to load one should look
        // like a screen with no photograph, never like a screen with an error.
      });

    return () => {
      live = false;
    };
  }, []);

  return account;
}
