/**
 * What we use of Paged.js, typed by hand.
 *
 * The package ships no declarations and there is no `@types/pagedjs`, so the
 * choice is this file or an `any` at the import — and an `any` there would take
 * the compiler off the one call the print path depends on.
 *
 * Deliberately narrow: `Previewer.preview` and the two fields of its result
 * that we read, rather than a guess at the whole library. Paged.js exports
 * `Chunker`, `Polisher`, `Handler` and a handler registry as well; none of them
 * is used here, and describing them from the outside would be inventing an API
 * contract we do not control and cannot keep in step.
 */
declare module "pagedjs" {
  /** A stylesheet, given as text. Paged.js also accepts urls and objects. */
  type PagedStylesheet = Record<string, string>;

  interface PagedFlow {
    /** Pages produced. */
    total: number;
    /** The element the pages were rendered into. */
    performance?: number;
  }

  export class Previewer {
    constructor(options?: Record<string, unknown>);
    /**
     * Paginate `content` under `stylesheets` and render the pages into
     * `renderTo`.
     *
     * Note what it does *not* do: the stylesheets Paged.js generates are
     * written into the document the script is running in, not into
     * `renderTo`'s document. See `print.ts`, which copies them across.
     */
    preview(
      content: string,
      stylesheets: PagedStylesheet[],
      renderTo: HTMLElement,
    ): Promise<PagedFlow>;
  }
}
