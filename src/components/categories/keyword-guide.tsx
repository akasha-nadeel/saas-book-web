"use client";

import { useEffect, useState } from "react";
import { KEYWORD_GUIDE, SOURCES } from "@/lib/keywords/guide";

/**
 * The keyword guide: a help centre for the seven boxes, over the screen that
 * has them.
 *
 * **A sheet rather than a dialog, and the reason is what this is for.** A modal
 * is for a decision that has to be made before anything else happens; a
 * drawer is for information somebody wants *while* they carry on working —
 * which is exactly this, since the thing being explained is the form still
 * visible behind it. It is the same layer the roadmap opens a tool in
 * (`roadmap-page.tsx`): fixed rather than absolute so it does not scroll away,
 * right-anchored and inset so the page underneath stays visible, `z-40` so a
 * dialog can still open over it, a real `<button>` for the backdrop, and
 * Escape.
 *
 * **Two panes, because a guide is a list of questions and a list of topics.**
 * Topics down the left in a card of their own, the chosen one's questions on
 * the right as disclosures. That is the shape every help centre worth copying
 * uses, and the reason is that it puts the whole scope on screen: a reader can
 * see there are five topics and that none of them is theirs, which a single
 * scrolling column never tells them.
 *
 * The rows are `<details>` — the browser's own disclosure, so it works with
 * no JavaScript, is announced correctly, and the browser's own find can search
 * inside it, the same reasoning the landing page's FAQ is written under.
 */
export function KeywordGuide({ onClose }: { onClose: () => void }) {
  const [topicId, setTopicId] = useState(KEYWORD_GUIDE[0].id);
  const topic = KEYWORD_GUIDE.find((t) => t.id === topicId) ?? KEYWORD_GUIDE[0];

  // Escape, which is the first thing anybody tries on a layer over a page.
  // Not captured, so a control inside that handles its own keys gets there
  // first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      {/* **The backdrop is a button, not a div with an onClick.** It is the
          largest dismiss target on the screen and the one most people reach
          for first, so it has to be focusable, named, and answer Enter. */}
      <button
        type="button"
        aria-label="Close the keyword guide"
        onClick={onClose}
        className="oc-scrim-in absolute inset-0 cursor-default bg-black/40 backdrop-blur-[1px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="How the seven keywords work"
        className="oc-panel-in absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col
                   overflow-hidden border-l border-line bg-surface shadow-2xl
                   lg:inset-y-3 lg:right-3 lg:rounded-2xl lg:border"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-tight text-fg">
              How the seven keywords work
            </h2>
            {/* The line that makes the guide worth opening when nothing is
                answering: all of this works with the model switched off. */}
            <p className="truncate text-xs text-muted">
              Everything the chat knows, written down — and it works offline.
            </p>
          </div>
          {/* A quiet outline rather than a fill: closing throws nothing away,
              and the one control on a bar of its own does not need a fill to
              be found. */}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-line px-3.5 py-1.5 text-sm
                       font-semibold text-fg outline-none transition-colors
                       hover:border-accent/60 hover:bg-raised
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Close ✕
          </button>
        </header>

        {/* One scroll context for the whole sheet rather than one per pane:
            two panes scrolling independently is the arrangement where a reader
            loses the topic list by scrolling the wrong half. The nav sticks
            instead, which keeps it in view at no such cost. */}
        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
            {/* ---- The topics ------------------------------------------
                A card of its own, as in every help centre: the chosen row is
                *raised out of it* rather than tinted, which is this app's own
                elevation language in both themes — lighter on black, white on
                the grey desk. */}
            <nav
              aria-label="Guide topics"
              className="rounded-xl border border-line bg-panel p-2 md:sticky md:top-0 md:self-start"
            >
              <ul className="flex flex-col gap-1">
                {KEYWORD_GUIDE.map((t) => {
                  const here = t.id === topic.id;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setTopicId(t.id)}
                        aria-current={here ? "true" : undefined}
                        className={`w-full rounded-lg px-3 py-2.5 text-left text-sm
                                    outline-none transition-colors
                                    focus-visible:ring-2 focus-visible:ring-accent/50 ${
                                      here
                                        ? "border border-line bg-raised font-semibold text-fg"
                                        : "border border-transparent text-muted hover:text-fg"
                                    }`}
                      >
                        {t.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* ---- The questions --------------------------------------- */}
            <div className="min-w-0">
              <h3 className="text-xl font-bold tracking-tight text-fg">
                {topic.title}
              </h3>
              <p className="mt-1 max-w-prose text-sm text-muted">{topic.lead}</p>

              {/* Keyed on the topic so the disclosures start closed again when
                  the topic changes: `<details>` keeps its own open state, and
                  without this the third row of the new topic would arrive
                  already open because the third row of the last one was. */}
              <div key={topic.id} className="mt-4 flex flex-col">
                {topic.entries.map((entry, i) => (
                  <details
                    key={entry.q}
                    open={i === 0}
                    className="group border-t border-line last:border-b"
                  >
                    {/* `list-none` and the WebKit rule together: Safari draws
                        its triangle through a pseudo-element the standard
                        property does not reach, so one without the other
                        leaves a marker in exactly one browser. */}
                    <summary
                      className="flex cursor-pointer list-none items-center justify-between gap-4
                                 py-3.5 text-sm font-medium text-fg
                                 [&::-webkit-details-marker]:hidden"
                    >
                      <span>{entry.q}</span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>

                    <div className="pb-4 pl-0.5">
                      {entry.a.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="max-w-prose text-sm leading-relaxed text-muted not-first:mt-2.5"
                        >
                          {paragraph}
                        </p>
                      ))}

                      {entry.steps && (
                        <ol className="mt-3 flex max-w-prose flex-col gap-2.5">
                          {entry.steps.map((step, n) => (
                            <li key={step} className="flex gap-3">
                              <span
                                aria-hidden="true"
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center
                                           rounded-full bg-raised text-[0.6875rem] font-bold
                                           text-fg tabular-nums"
                              >
                                {n + 1}
                              </span>
                              <span className="text-sm leading-relaxed text-muted">
                                {step}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </details>
                ))}
              </div>

              {/* **Where every fact came from.** This is the subject with more
                  confident wrong advice attached to it than any other part of
                  self-publishing, so the only honest answer to "says who?" is
                  a link to the shop. */}
              <div className="mt-8 border-t border-line pt-4">
                <p className="text-xs font-semibold text-fg">
                  Checked against Amazon&rsquo;s own pages
                </p>
                {/* **Blue, and it is the palette's existing blue rather than a
                    new one.** `badge-blue-ink` was picked by contrast in both
                    themes — #1d4ed8 by day, a light blue at night — so it is
                    legible on this ground either way, and reusing it is what
                    stops a second blue three shades off the first from
                    appearing. These are the one place on this screen that
                    leaves the app entirely, which is what the colour is
                    marking. */}
                <ul className="mt-2 flex flex-col gap-1.5">
                  {SOURCES.map((source) => (
                    <li key={source.href}>
                      <a
                        href={source.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-badge-blue-ink underline decoration-badge-blue-line
                                   underline-offset-2 hover:decoration-badge-blue-ink"
                      >
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 max-w-prose text-xs text-muted">
                  Their pages change. Where one of them disagrees with anything
                  here, they are right and this is out of date.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
