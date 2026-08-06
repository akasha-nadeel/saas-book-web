"use client";

import { useState } from "react";
import { useMyInvites } from "@/lib/use-collab";
import {
  InviteWaitingDialog,
  shouldAnnounce,
} from "./invite-waiting-dialog";

/**
 * The dashboard's one standing question: has anybody invited me?
 *
 * Kept as its own tiny component rather than folded into the shelf, for the
 * reason `LibrarySync` is its own component: the shelf is already an enormous
 * client file, and a hook plus two pieces of state added to it for a dialog that
 * is usually not shown is how that file got enormous.
 *
 * It renders nothing at all in the common case — no invitations, or a session
 * that has already been told — so mounting it costs one request and no markup.
 */
export function InviteWatch({ onSee }: { onSee: () => void }) {
  const { invites, loading } = useMyInvites();
  /*
   * **Dismissal is state, not an absence.** `shouldAnnounce` reads
   * sessionStorage, and sessionStorage is written on *open* rather than on close
   * — so without a flag here, closing the dialog would leave `shouldAnnounce`
   * still true for this render and put it straight back up.
   */
  const [dismissed, setDismissed] = useState(false);

  /*
   * **`loading` first, and it is doing more than it looks.**
   *
   * `shouldAnnounce` reads sessionStorage during render, which on its own would
   * be a hydration mismatch: the server has no `window` and answers false, while
   * the client's first render could answer true and produce a dialog the server
   * never sent. It is safe only because `useMyInvites` starts `loading` — so both
   * the server render and the first client render return null here, and the
   * answer changes later, after hydration, when a fetch resolves.
   *
   * Reorder these and the mismatch is real. Keep `loading` first.
   */
  if (loading || dismissed || !shouldAnnounce(invites)) return null;

  return (
    <InviteWaitingDialog
      invites={invites}
      onSee={() => {
        setDismissed(true);
        onSee();
      }}
      onClose={() => setDismissed(true)}
    />
  );
}
