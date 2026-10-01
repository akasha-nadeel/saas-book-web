"use client";

import { useEffect, useRef, useState } from "react";
import {
  addLink,
  entryMatches,
  KINDS,
  LINK_KINDS,
  suggestLink,
  type BibleEntry,
  type BibleLink,
  type LinkKind,
} from "@/lib/bible";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SearchGlyph } from "@/components/ui/field";
import { ListGroup, ListRow, SectionHeader } from "@/components/ui/list";
import { KindMark } from "./kind-marks";
import { BackButton, PageBar, PageColumn } from "./page-bar";

/**
 * Connect one entry to another: pick who, then say how.
 *
 * **A page of rows rather than two native menus**, because the thing being
 * chosen is another entry — with a kind, a mark and a name the writer
 * recognises — and a `<select>` flattens all of that into a column of text.
 *
 * **The words are suggested, never assumed.** Picking a place for a person
 * preselects "Lives in"; the choice sits in plain view above the button that
 * writes it, and nothing is stored until that button is pressed. A wrong
 * guess costs one tap to correct, and a link nobody worded is never written.
 */
export function ConnectPage({
  from,
  entries,
  onBack,
  onConnect,
}: {
  from: BibleEntry;
  /** The same book's entries: a link can only point inside one bible. */
  entries: readonly BibleEntry[];
  onBack: () => void;
  onConnect: (link: BibleLink) => void;
}) {
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<BibleEntry | null>(null);
  const [kind, setKind] = useState<LinkKind>("related-to");

  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
  }, []);

  const others = entries.filter(
    (e) => e.id !== from.id && entryMatches([e.name, ...e.aka], e.detail, query),
  );
  /* `addLink` hands the list back untouched when it would refuse — which, for a
     target that exists and is not this entry, means the link already stands.
     Asking it is what keeps this screen and the store agreeing about
     "already linked", including a "related to" written from the other end. */
  const refused =
    target !== null && addLink(entries, from.id, { to: target.id, kind }) === entries;

  function pick(entry: BibleEntry) {
    if (target?.id === entry.id) {
      setTarget(null);
      return;
    }
    setTarget(entry);
    setKind(suggestLink(from.kind, entry.kind));
  }

  return (
    <>
      <PageBar left={<BackButton label={from.name} onClick={onBack} />} />

      <PageColumn>
        <h2
          ref={title}
          tabIndex={-1}
          className="px-1 pt-2 pb-4 font-sans text-[26px] leading-tight font-bold tracking-tight break-words text-fg outline-none"
        >
          Connect {from.name} to…
        </h2>
        <Field
          glyph={<SearchGlyph />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          clearLabel="Clear the search"
          placeholder="Search entries"
          aria-label="Search entries"
          className="mb-5 font-sans"
        />

        {others.length === 0 ? (
          <EmptyState title="Nothing matches">
            No other entry is called or says “{query.trim()}”.
          </EmptyState>
        ) : (
          KINDS.map((k) => {
            const inKind = others.filter((e) => e.kind === k.id);
            if (inKind.length === 0) return null;
            return (
              <div key={k.id} className="mb-4">
                <SectionHeader trailing={inKind.length}>{k.label}</SectionHeader>
                <ListGroup as="ul">
                  {inKind.map((e) => {
                    const on = target?.id === e.id;
                    return (
                      <li key={e.id}>
                        <ListRow
                          onClick={() => pick(e)}
                          active={on}
                          leading={<KindMark kind={e.kind} size="xs" />}
                          title={e.name}
                          detail={e.aka.length > 0 ? e.aka.join(", ") : undefined}
                          trailing={on ? <Tick /> : undefined}
                        />
                      </li>
                    );
                  })}
                </ListGroup>
              </div>
            );
          })
        )}
      </PageColumn>

      {/* Sticky at the foot of the view, on the same material as the bar at
          its head: the choice and the button that writes it stay in reach
          however long the list above them runs. */}
      {target && (
        <div className="sticky bottom-0 z-10 border-t border-line bg-surface/75 backdrop-blur-md">
          <div className="mx-auto w-full max-w-2xl px-5 pt-3 pb-4 sm:px-8">
          <SectionHeader>
            How is {from.name} connected to {target.name}?
          </SectionHeader>
          <div role="group" aria-label="How they are connected" className="flex flex-wrap gap-1.5">
            {LINK_KINDS.map((l) => {
              const on = kind === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setKind(l.id)}
                  className={`rounded-full border px-2.5 py-1 font-sans text-[12px] outline-none
                              transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                on
                                  ? "border-transparent bg-raised font-semibold text-fg"
                                  : "border-line text-muted hover:text-fg"
                              }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => !refused && onConnect({ to: target.id, kind })}
            disabled={refused}
            className="mt-3 w-full rounded-[10px] bg-accent py-2 font-sans text-[13px] font-semibold
                       text-accent-ink outline-none transition-colors hover:bg-accent-strong
                       focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
          >
            {refused ? "Already connected this way" : "Connect"}
          </button>
          </div>
        </div>
      )}
    </>
  );
}

function Tick() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-accent"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
