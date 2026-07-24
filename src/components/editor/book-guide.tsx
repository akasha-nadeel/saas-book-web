"use client";

/**
 * What fills the workspace when no chapter is open — the book's overview.
 *
 * Rather than dropping the writer straight into a chapter, the book opens on a
 * short guide: pick a chapter to write, and how the three parts of a book work.
 * It reads on the page's own surface, centred like a title page.
 */
export function BookGuide({ title }: { title: string }) {
  return (
    <div className="scroll-slim h-full overflow-y-auto bg-surface">
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="font-sans text-xs tracking-wide text-muted uppercase">
          Book overview
        </p>
        <h1 className="mt-2 font-serif text-3xl text-fg">{title}</h1>
        <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
          Choose a chapter from the panel on the left to start writing. Here is
          how the panel is laid out.
        </p>

        <div className="mt-8 flex flex-col gap-6">
          <section>
            <h2 className="font-sans text-sm font-semibold text-fg">Chapters</h2>
            <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
              Every chapter is a row in the panel. Click one to open it.{" "}
              <span className="text-fg">New chapter</span> adds one; the upload
              button beside it brings a <code className="rounded bg-raised px-1">.docx</code>,{" "}
              <code className="rounded bg-raised px-1">.epub</code>,{" "}
              <code className="rounded bg-raised px-1">.md</code>,{" "}
              <code className="rounded bg-raised px-1">.txt</code>, or{" "}
              <code className="rounded bg-raised px-1">.html</code> file in.
              Drag a row to reorder it, or press{" "}
              <kbd className="rounded bg-raised px-1 text-xs">Alt</kbd> +{" "}
              <kbd className="rounded bg-raised px-1 text-xs">↑</kbd>/
              <kbd className="rounded bg-raised px-1 text-xs">↓</kbd>.
            </p>
          </section>

          <section>
            <h2 className="font-sans text-sm font-semibold text-fg">
              Read the whole book
            </h2>
            <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
              The open-book button on the rail opens a reading view — every
              chapter on one page, top to bottom, the way the book reads. Scroll
              it end to end, and click any chapter’s title to jump back into
              editing it.
            </p>
          </section>

          <section>
            <h2 className="font-sans text-sm font-semibold text-fg">
              Front &amp; back matter
            </h2>
            <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
              A book is more than its chapters. Two buttons in the panel bracket
              the body — <span className="text-fg">Front matter</span> above,{" "}
              <span className="text-fg">Back matter</span> below.
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              Click one and it opens a page already laid out with that part’s
              standard sections as headings, for you to fill in:
            </p>
            <ul className="mt-3 flex flex-col gap-2 font-sans text-sm leading-relaxed text-muted">
              <li>
                <span className="font-medium text-fg">Front matter</span> —
                half-title, title page, copyright, dedication, epigraph, table of
                contents, preface, prologue.
              </li>
              <li>
                <span className="font-medium text-fg">Back matter</span> —
                epilogue, acknowledgements, about the author, about the book,
                other books by the author.
              </li>
            </ul>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              Write under the sections you want and delete the rest. These pages
              are named, never numbered — a title page is not “Chapter 1”.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
