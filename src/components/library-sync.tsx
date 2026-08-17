"use client";

import { useEffect } from "react";
import { loadFromDisk, syncWithServer } from "@/lib/library-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { askToPersist } from "@/lib/storage-space";
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
    /* **Above the guard, deliberately.**
       Everything below this line is about the server, and the writers who most
       need the browser to stop evicting their library are exactly the ones with
       no server behind them — the local-only writers the guard returns early
       for. See `askToPersist`: without it a browser may clear the whole origin
       under disk pressure, and Safari does it after a week away. */
    void askToPersist();

    /* **The disk, before anything else and above the guard for the same
       reason.** The manuscript lives in IndexedDB, and every screen is waiting
       on `useHydrated` until it has been read — so a local-only writer whose
       app never reached this line would sit on a loading screen forever. It is
       idempotent and `syncWithServer` awaits it too, which is belt and braces
       on the one thing here that must not fail to happen. */
    void loadFromDisk();

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
