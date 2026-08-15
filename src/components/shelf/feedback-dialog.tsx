"use client";

import { useEffect, useRef, useState } from "react";
import {
  checkDraft,
  MESSAGE_MAX,
  SENTIMENTS,
  TOPICS,
  toRow,
  type Sentiment,
} from "@/lib/feedback";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

/**
 * The suggestion box.
 *
 * It goes to whoever runs the app and to nobody else — the table has an insert
 * grant and no select policy at all, so a writer cannot read another writer's
 * notes or their own. There is no screen listing these on purpose: the moment
 * one exists, somebody has to decide what happens when a writer reads a
 * complaint about themselves.
 *
 * **It says what it sends, above the button.** Every other screen in this app
 * promises the manuscript stays in the browser, and a form that quietly posted
 * "a little context to help us debug" would undo that promise on the one screen
 * where a writer is being asked to trust us. Three things go: the topic, the
 * message, and a face if one was pressed. Nothing reads a book.
 *
 * Degrades the way everything else does. With no Supabase project there is
 * nowhere to send anything, so it says that rather than pretending — and if the
 * table has not been created yet, the error names the migration instead of
 * showing a Postgres code.
 */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const configured = isSupabaseConfigured();

  async function send() {
    const draft = { topic, message, ...(sentiment ? { sentiment } : {}) };
    const wrong = checkDraft(draft);
    if (wrong) {
      setProblem(wrong);
      return;
    }

    setSending(true);
    setProblem(null);
    try {
      // `owner` is left off deliberately — the column defaults to auth.uid(),
      // so the account it lands under is the session's rather than anything
      // this form could be persuaded to put in it.
      const { error } = await createClient()
        .from("feedback")
        .insert(toRow(draft));

      if (error) {
        setProblem(
          // The migration has not been run on this project. Worth naming,
          // because the fix is a file in this repo rather than anything the
          // writer can do.
          //
          // **Two codes, and PGRST205 is the one that actually fires.**
          // 42P01 is Postgres' "relation does not exist", which only comes
          // back for a table PostgREST still has in its schema cache and
          // finds gone underneath it. A table that was *never created* never
          // reaches Postgres at all: PostgREST refuses it up front with
          // PGRST205. Matching 42P01 alone meant this branch could not fire
          // in the situation it was written for, and a live project missing
          // the migration reported the generic "that did not send" instead —
          // which is exactly how it went unnoticed. `sync.ts` and
          // `use-collab.ts` both already name PGRST205 for this.
          error.code === "42P01" || error.code === "PGRST205"
            ? "The feedback table is not on this project yet — supabase/migrations/20260801000000_feedback.sql has not been applied."
            : "That did not send. Your note is still here, so you can try again.",
        );
        return;
      }
      setSent(true);
    } catch {
      setProblem(
        "That did not send. Your note is still here, so you can try again.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[30rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line
                 bg-panel p-0 text-fg backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div>
          <h2 className="text-lg font-bold">Send feedback</h2>
          <p className="mt-0.5 text-sm text-muted">
            It comes straight to us. No other writer sees it.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 shrink-0 rounded-lg px-2.5 py-1.5 text-xl leading-none
                     text-muted hover:bg-raised"
        >
          ×
        </button>
      </div>

      {sent ? (
        <div className="px-6 py-8 text-center">
          <p className="text-lg font-bold text-fg">Thank you — that arrived.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            We read all of it. There is no reply address on this, so if you need
            an answer rather than to be heard, the Help guide is the faster
            route.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
          >
            Back to writing
          </button>
        </div>
      ) : !configured ? (
        <div className="px-6 py-8">
          <p className="font-bold text-fg">There is nowhere to send this.</p>
          <p className="mt-2 text-sm text-muted">
            This copy of OpenChapter runs without a Supabase project, so it has
            no server to post to. Everything else works exactly as it does with
            one — see <code>.env.local.example</code>.
          </p>
        </div>
      ) : (
        <form
          className="px-6 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="block">
            <span className="text-sm font-bold text-fg">
              What is this about?
            </span>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2
                         text-sm text-fg outline-none focus-visible:ring-2
                         focus-visible:ring-accent/50"
            >
              <option value="">Select a topic…</option>
              {TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-bold text-fg">
              What happened, or what would help?
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={MESSAGE_MAX}
              placeholder="The more specific, the more we can do about it."
              className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface
                         px-3 py-2 text-sm leading-relaxed text-fg outline-none
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </label>

          <div className="mt-4">
            <p className="text-sm font-bold text-fg">
              How is it going, overall?{" "}
              <span className="font-normal text-muted">Optional.</span>
            </p>
            <div className="mt-2 flex gap-2">
              {SENTIMENTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  // Pressing the chosen face again clears it. Otherwise the
                  // first tap is permanent, and a writer who mis-clicked has to
                  // pick a mood they do not mean.
                  onClick={() =>
                    setSentiment((was) => (was === s.id ? undefined : s.id))
                  }
                  aria-pressed={sentiment === s.id}
                  title={s.label}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border
                              text-lg transition-colors ${
                                sentiment === s.id
                                  ? "border-accent bg-accent/10"
                                  : "border-line bg-surface hover:bg-raised"
                              }`}
                >
                  <span aria-hidden="true">{s.face}</span>
                  <span className="sr-only">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {problem && (
            <p className="mt-4 rounded-lg border border-line bg-raised px-3 py-2 text-sm text-fg">
              {problem}
            </p>
          )}

          {/* Stated, and stated here rather than in a privacy page nobody
              opens. This is the one screen where a writer is being asked to
              send us something, on a product whose pitch is that nothing
              leaves the machine. */}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Sent: the topic, your message, and the face if you picked one. Your
            account is attached so we can tell one writer&rsquo;s notes from
            another&rsquo;s. Nothing from your books goes — no title, no
            chapter, not a word of the manuscript.
          </p>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink
                         disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
