"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DialogClose, Divider, Shell } from "@/components/ui/dialog";
import { rememberNoticeSeen } from "@/lib/library-store";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useLibrarySettled, usePrefs, useShelf } from "@/lib/use-library";
import {
  NOTICE_FROM,
  NOTICE_UNLIMITED_BOOKS,
  seenFromMetadata,
  shouldShowNotice,
} from "@/lib/whats-new";

/**
 * "Unlimited books, free." — told once to the writers who were here before.
 *
 * **Mounted on the dashboard only, never over the editor.** A notice that
 * lands on somebody mid-sentence costs more than it tells them; the dashboard
 * is where a writer arrives and looks around, so it waits for that.
 *
 * **Shown the way a good product shows one** (2026-10-13, the owner's ask):
 * - once per account, not once per browser — answering it writes the id to
 *   this machine's prefs *and* to the account's `user_metadata`, so a second
 *   device does not ask again;
 * - only to writers who were here before the change (`shouldShowNotice`), and
 *   no sign-in is needed to see it — the session they already have is read;
 * - after the dashboard has painted, never in the way of first paint, and not
 *   on top of another dialog;
 * - answered by either button, the cross or Escape; leaving without
 *   answering shows it again next visit.
 */

const DELAY_MS = 600;
/** How often to look again while another dialog is up. */
const RETRY_MS = 2000;

type Account = { createdAt: number | null; seen: string[] };

export function WhatsNew() {
  const router = useRouter();
  const settled = useLibrarySettled();
  const shelf = useShelf();
  const locallySeen = usePrefs().noticesSeen.includes(NOTICE_UNLIMITED_BOOKS);
  const accounts = isSupabaseConfigured();

  /* The account, read once and only while the notice is still unanswered on
     this machine. With no accounts configured there is nothing to read, and
     the books decide. */
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (locallySeen || !accounts) return;
    let live = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!live) return;
        const user = data.user;
        const created = user?.created_at ? Date.parse(user.created_at) : Number.NaN;
        setAccount({
          createdAt: Number.isFinite(created) ? created : null,
          seen: seenFromMetadata(user?.user_metadata),
        });
      })
      // Offline or refused: no account answer, so the books decide.
      .catch(() => live && setAccount({ createdAt: null, seen: [] }));
    return () => {
      live = false;
    };
  }, [locallySeen, accounts]);

  const ready = settled && (!accounts || account !== null);
  const show =
    ready &&
    !locallySeen &&
    shouldShowNotice({
      id: NOTICE_UNLIMITED_BOOKS,
      seen: account?.seen ?? [],
      accountCreatedAt: account?.createdAt ?? null,
      books: shelf.books,
      from: NOTICE_FROM,
    });

  /* An account that answered on another device is remembered here too, so
     this machine stops asking the server. */
  useEffect(() => {
    if (account?.seen.includes(NOTICE_UNLIMITED_BOOKS) && !locallySeen) {
      rememberNoticeSeen(NOTICE_UNLIMITED_BOOKS);
    }
  }, [account, locallySeen]);

  useEffect(() => {
    if (!show) return;
    let timer = 0;
    const attempt = () => {
      // Never on top of another dialog: wait for it to close.
      if (document.querySelector("dialog[open]")) {
        timer = window.setTimeout(attempt, RETRY_MS);
        return;
      }
      setOpen(true);
    };
    timer = window.setTimeout(attempt, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [show]);

  function answer() {
    setOpen(false);
    rememberNoticeSeen(NOTICE_UNLIMITED_BOOKS);
    if (!accounts) return;
    const seen = [...new Set([...(account?.seen ?? []), NOTICE_UNLIMITED_BOOKS])];
    // Fire and forget: the local record already stops it here.
    void createClient()
      .auth.updateUser({ data: { notices_seen: seen } })
      .catch(() => {});
  }

  if (!open) return null;

  return (
    <Shell onClose={answer}>
      <DialogClose onClose={answer} />
      <p className="font-sans text-xs font-semibold tracking-wide text-tremor-content uppercase">
        What&rsquo;s new
      </p>
      <h2 className="mt-1 pr-8 font-serif text-2xl text-tremor-content-strong">
        Unlimited books, free.
      </h2>
      <div className="mt-3 space-y-2 font-sans text-sm leading-6 text-tremor-content">
        <p>
          Every plan now holds as many books as you write — Free included. Start
          the next one whenever you like.
        </p>
        <p>
          Nothing else changed: your books, your exports and your plan are as
          they were.
        </p>
      </div>

      <Divider />

      <div className="oc-dialog-actions flex justify-end gap-2">
        <Button variant="secondary" onClick={answer}>
          Got it
        </Button>
        <Button
          variant="primary"
          autoFocus
          onClick={() => {
            answer();
            router.push("/book/new");
          }}
        >
          Start a new book
        </Button>
      </div>
    </Shell>
  );
}
