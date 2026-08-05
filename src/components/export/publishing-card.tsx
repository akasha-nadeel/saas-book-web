"use client";

import { useMemo, useState } from "react";
import { checkStoreReadiness } from "@/lib/export";
import { setPublishing, type Book } from "@/lib/library-store";
import {
  BLURB_MAX,
  DEFAULT_LANGUAGE,
  isValidIsbn13,
  type PublishingMeta,
  type ReadinessIssue,
} from "@/lib/publishing";

/**
 * The details a shop asks for, in the two halves the export wizard shows them
 * as: what the book *is* (`ListingDetails`) and how it is *found*
 * (`ListingBlurb`). Split because eight fields on one screen is the thing the
 * step pattern exists to avoid — and because they are answered at different
 * times, an ISBN when it is issued and a blurb when it is written.
 *
 * Shown only for EPUB, because it is the only format anybody sells: attaching an
 * ISBN to a Markdown download would be asking a writer to fill in a form for a
 * file nobody will list.
 *
 * Every field writes through to the book, so the answers survive the export and
 * the writer fills this in once rather than once per attempt. They commit on
 * blur rather than on each keystroke — the shelf is one document, so a write per
 * character would rewrite the whole library, and push it, thirty times a
 * sentence.
 */

const LANGUAGES: [code: string, label: string][] = [
  ["en", "English"],
  ["en-GB", "English (United Kingdom)"],
  ["en-US", "English (United States)"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["pt-BR", "Portuguese (Brazil)"],
  ["nl", "Dutch"],
  ["sv", "Swedish"],
  ["pl", "Polish"],
  ["ru", "Russian"],
  ["ar", "Arabic"],
  ["hi", "Hindi"],
  ["ur", "Urdu"],
  ["zh", "Chinese"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
];

/**
 * The form, over either the book or a draft of it.
 *
 * It wrote straight through to the store for its whole life, which is right
 * inside the export wizard — the fields sit above a Continue button, so the
 * commit and the closure are the same gesture. On the listing *tool* they are
 * not: there is no next step, so six boxes were filled and nothing on the page
 * said whether any of it landed.
 *
 * So the values and the sink are both optional. Pass neither and it behaves
 * exactly as it did (the wizard); pass a draft and a setter and the screen
 * owns the commit (the tool, whose Save button writes the lot). Two callers,
 * one form — the point of extracting it in the first place.
 */
export function ListingDetails({
  book,
  meta = book.publishing,
  onChange,
}: {
  book: Book;
  /** What the fields show. Defaults to what is stored on the book. */
  meta?: PublishingMeta | undefined;
  /** Where a committed field goes. Defaults to straight to the book. */
  onChange?: (patch: Partial<PublishingMeta>) => void;
}) {
  const write =
    onChange ?? ((patch: Partial<PublishingMeta>) => setPublishing(book.id, patch));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="ISBN"
          hint="13 digits. Amazon assigns its own; Apple and Kobo want yours."
          value={meta?.isbn ?? ""}
          placeholder="978-0-306-40615-7"
          onCommit={(isbn) => write({ isbn })}
          // Checked as you leave the field rather than at the end, because a
          // mistyped digit is invisible to read back.
          validate={(v) =>
            v.trim() && !isValidIsbn13(v)
              ? "That check digit doesn’t add up."
              : null
          }
        />

        <label className="block">
          <span className="block font-sans text-xs font-medium text-fg">
            Language
          </span>
          <select
            value={meta?.language ?? DEFAULT_LANGUAGE}
            onChange={(e) => write({ language: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-line bg-panel px-3
                       py-2.5 font-sans text-sm text-fg outline-none
                       focus-visible:border-accent focus-visible:ring-2
                       focus-visible:ring-accent/20"
          >
            {LANGUAGES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-sans text-xs text-muted">
            Decides which storefront the book is listed on.
          </span>
        </label>

        <Field
          label="Publisher"
          hint="Your own name is the usual answer when self-publishing."
          value={meta?.publisher ?? ""}
          placeholder={book.author ?? "Your imprint"}
          onCommit={(publisher) => write({ publisher })}
        />

        <Field
          label="Publication date"
          hint="Leave empty until it has one."
          type="date"
          value={meta?.published ?? ""}
          onCommit={(published) => write({ published })}
        />

        <Field
          label="Series"
          hint="The shelf this book belongs to, if any."
          value={meta?.series ?? ""}
          placeholder="The Salt Cycle"
          onCommit={(series) => write({ series })}
        />

        <Field
          label="Number in series"
          hint="As a reader would count it."
          type="number"
          value={meta?.seriesIndex?.toString() ?? ""}
          placeholder="2"
          onCommit={(raw) => {
            const n = Number(raw);
            write({
              seriesIndex:
                raw.trim() && Number.isFinite(n) && n > 0 ? Math.round(n) : undefined,
            });
          }}
        />
      </div>
    </div>
  );
}

export function ListingBlurb({ book }: { book: Book }) {
  const meta = book.publishing;

  return (
    <div className="space-y-5">
      <Blurb
        value={meta?.description ?? ""}
        onCommit={(description) => setPublishing(book.id, { description })}
      />

      <Field
        label="Categories"
        hint="Separated by commas. BISAC headings work, plain words do too — these decide which shelf the book turns up on."
        value={(meta?.subjects ?? []).join(", ")}
        placeholder="Fiction / Literary, Fiction / Sagas"
        onCommit={(raw) =>
          setPublishing(book.id, {
            subjects: raw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      />

      <Note>
        Categories are how a reader who has never heard of you finds the book.
        Two or three specific ones beat a dozen broad ones.
      </Note>
    </div>
  );
}

/**
 * The aside that explains a field without turning it into
 * a paragraph of label. Kept here rather than in the page so the copy sits
 * beside the control it is about.
 */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="flex gap-2.5 rounded-md border border-accent/25 bg-accent/5 px-3
                 py-2.5 font-sans text-xs leading-relaxed text-muted"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-px h-4 w-4 shrink-0 text-accent"
      >
        <circle cx="10" cy="10" r="7.25" />
        <path d="M10 9.2v4.2M10 6.6v.1" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/**
 * A text field that holds its own value while it is being typed in and hands it
 * over on the way out.
 *
 * The book is the source of truth, but not the source of *keystrokes* — driving
 * the input from the store would commit a shelf write per character. The effect
 * re-seeds the draft when the book's own value changes underneath, which is what
 * makes a second tab's edit show up here.
 */
function Field({
  label,
  hint,
  value,
  placeholder,
  type = "text",
  onCommit,
  validate,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  type?: "text" | "date" | "number";
  onCommit: (value: string) => void;
  validate?: (value: string) => string | null;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  // React's own way of resetting state when a prop changes: compare against the
  // last value *during* render rather than syncing in an effect, which would
  // paint the stale draft first and then replace it. See "You Might Not Need an
  // Effect" — an effect here is also what the lint rule is pointing at.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  const commit = () => {
    setError(validate?.(draft) ?? null);
    if (draft !== value) onCommit(draft);
  };

  return (
    <label className="block">
      <span className="block font-sans text-xs font-medium text-fg">
        {label}
      </span>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="mt-1.5 w-full rounded-md border border-line bg-panel px-3
                   py-2.5 font-sans text-sm text-fg placeholder:text-muted/70
                   outline-none focus-visible:border-accent focus-visible:ring-2
                   focus-visible:ring-accent/20"
      />
      {error ? (
        <span className="mt-1 block font-sans text-xs text-danger">{error}</span>
      ) : (
        hint && (
          <span className="mt-1 block font-sans text-xs text-muted">{hint}</span>
        )
      )}
    </label>
  );
}

function Blurb({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value);
  }

  const over = draft.trim().length > BLURB_MAX;

  return (
    <label className="block">
      <span className="block font-sans text-xs font-medium text-fg">
        Description
      </span>
      <textarea
        value={draft}
        rows={5}
        placeholder="The text a shop shows under the cover."
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        className="mt-1.5 w-full resize-y rounded-md border border-line bg-panel
                   px-3 py-2.5 font-sans text-sm leading-relaxed text-fg
                   placeholder:text-muted/70 outline-none
                   focus-visible:border-accent focus-visible:ring-2
                   focus-visible:ring-accent/20"
      />
      <span
        className={`mt-1 block font-sans text-xs ${over ? "text-danger" : "text-muted"}`}
      >
        {draft.trim().length.toLocaleString()} of {BLURB_MAX.toLocaleString()}{" "}
        characters
        {over ? " — over the limit every shop sets." : ""}
      </span>
    </label>
  );
}

/**
 * The readiness check, and the reading of the whole book it takes.
 *
 * Its own component so the memo lives here: the export page decides whether the
 * book exists before it renders anything, and a hook cannot sit behind that
 * decision. Recomputed when the book changes — which covers a chapter edited in
 * another tab, since the shelf is what changes then — and when the cover does.
 */
export function StoreReadiness({
  book,
  cover,
}: {
  book: Book;
  cover: string | null;
}) {
  const issues = useMemo(
    () => checkStoreReadiness(book, cover),
    [book, cover],
  );
  return <ReadinessPanel issues={issues} />;
}

/**
 * What is still standing between this book and a shop.
 *
 * Blocking issues are the ones a store's own validator fails on; advisory ones
 * are the difference between listed and found. Neither disables the export
 * button — a writer is allowed to want the file for their own reader, and a
 * greyed-out button with no way to reach it is worse than a plain warning.
 */
export function ReadinessPanel({ issues }: { issues: readonly ReadinessIssue[] }) {
  const blocking = issues.filter((i) => i.level === "blocking");
  const advisory = issues.filter((i) => i.level === "advisory");

  if (issues.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-line bg-surface px-3 py-2.5">
        <p className="font-sans text-sm font-medium text-fg">
          Ready for the shops.
        </p>
        <p className="mt-0.5 font-sans text-xs text-muted">
          Cover, metadata and images are all in order.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {blocking.length > 0 && (
        <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5">
          <p className="font-sans text-xs font-semibold text-danger">
            {blocking.length === 1
              ? "One thing will stop a shop taking this"
              : `${blocking.length} things will stop a shop taking this`}
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {blocking.map((issue) => (
              <li key={issue.field} className="font-sans text-xs text-fg">
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {advisory.length > 0 && (
        <div className="rounded-md border border-line bg-surface px-3 py-2.5">
          <p className="font-sans text-xs font-semibold text-fg">
            Worth fixing first
          </p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {advisory.map((issue) => (
              <li key={issue.field} className="font-sans text-xs text-muted">
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export type { PublishingMeta };
