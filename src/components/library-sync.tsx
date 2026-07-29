"use client";

import { useEffect } from "react";
import { syncWithServer } from "@/lib/library-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { flushNow } from "@/lib/sync";

/**
 * Reconciles this browser with the server once per load, and makes sure queued
 * writes leave before the tab does.
 *
 * Mount is enough to catch every way in. Signing in — by password, by Google,
 * by a link in an email — always ends in a Server Action redirect or a full
 * navigation, so the app remounts and this runs again. Subscribing to auth
 * events as well would only fire a second, redundant sync on the same load.
 *
 * Renders nothing. It sits in the root layout beside ThemeSync because the
 * reconciliation has to happen whichever screen the writer landed on.
 */
export function LibrarySync() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    void syncWithServer();

    // Pushes are batched on a short timer, so a tab closed straight after a
    // save could take the last one with it. visibilitychange fires on the
    // paths that actually matter — closing, switching app, locking the phone —
    // where unload is unreliable on mobile.
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, []);

  return null;
}
