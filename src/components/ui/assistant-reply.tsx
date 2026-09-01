import { CopyButton } from "@/components/ui/copy-button";
import {
  blockText,
  isOffered,
  parseMarkdown,
  runsText,
  type Block,
  type Run,
} from "@/lib/markdown";

/**
 * One assistant reply, rendered.
 *
 * **On this shelf because there are three of them.** The editor's assistant,
 * the blurb workshop and the keyword workshop each printed the model's answer
 * with `whitespace-pre-wrap`, so all three showed `* **Tightening:** …` with
 * the asterisks in it. Three copies of a fix is how one of them ends up a
 * release behind, and this is exactly the third-copy rule `src/components/ui/`
 * exists for.
 *
 * **Nothing here is `dangerouslySetInnerHTML`, and nothing ever may be.**
 * `markdown.ts` returns data; this turns it into elements. A model can be
 * talked into writing a `<script>` tag, and the whole safety of this feature is
 * that the tag would arrive here as six characters of text and be rendered as
 * six characters of text.
 *
 * **No `"use client"` of its own, and that is not the same as being a Server
 * Component.** All three callers are client components, so this is pulled into
 * their bundle and renders on the client with them — the directive is simply
 * theirs to declare rather than this file's to repeat. What it does buy is that
 * nothing here *needs* a client: no state, no effects, no handlers. The one
 * interactive part is `CopyButton`, which carries its own directive. So if a
 * Server Component ever wants to print a reply, it can.
 *
 * **The type is `text-sm` and the rhythm is tight**, because two of the three
 * callers are a ~300px rail. Headings step down by weight rather than by size:
 * at this width a genuinely larger `h1` in a bubble reads as a different
 * component rather than as a heading.
 *
 * **The whole reply is re-parsed on every streamed chunk, and that is fine —
 * measured rather than assumed.** A 9.5KB reply parses in ~3.3ms, inside a
 * frame, and a real reply arrives in tens of chunks rather than hundreds. So
 * there is deliberately no memo here: `useMemo` keyed on the text would miss on
 * every chunk anyway, since the text is what changed, and adding a hook would
 * cost this file its freedom to render on a server. Revisit only if a reply
 * ever gets long enough to be felt.
 */
export function AssistantReply({
  text,
  /**
   * Extra controls to draw on a block of offered prose, beside Copy.
   *
   * A render slot rather than a set of handlers, so this file keeps knowing
   * nothing about what a caller does with a passage. The editor's assistant
   * passes an Apply control here; the two workshops pass nothing and are
   * unchanged, which is the whole reason it is optional.
   *
   * It receives the block, so a caller can read `blockText` itself rather than
   * being handed a string it would have to trust this component to have
   * flattened the same way the clipboard does.
   */
  actions,
  /**
   * Whether to offer a copy button on blocks that hold offered prose.
   *
   * On by default and off for the two workshops' short conversational turns,
   * where the thing worth copying is the draft they already have their own
   * control for — a second copy button beside it would be two ways to take the
   * same words, one of which does less.
   */
  copyable = true,
  className = "",
}: {
  text: string;
  actions?: (block: Block) => React.ReactNode;
  copyable?: boolean;
  className?: string;
}) {
  const blocks = parseMarkdown(text);
  if (blocks.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2.5 text-sm text-fg ${className}`}>
      {blocks.map((block, i) => (
        <Piece key={i} block={block} copyable={copyable} actions={actions} />
      ))}
    </div>
  );
}

function Piece({
  block,
  copyable,
  actions,
}: {
  block: Block;
  copyable: boolean;
  actions?: (block: Block) => React.ReactNode;
}) {
  switch (block.kind) {
    case "heading":
      /* Weight and colour, not size — see the note above. */
      return (
        <p
          className={`font-sans font-semibold text-fg ${
            block.level === 1 ? "text-[0.9375rem]" : "text-sm"
          } ${block.level === 3 ? "text-muted" : ""}`}
        >
          <Runs runs={block.runs} />
        </p>
      );

    case "list":
      return (
        <ListBlock ordered={block.ordered} items={block.items} />
      );

    case "quote":
      /* **A quote is where a model puts prose it is offering**, so it is drawn
         as something liftable rather than as a styled paragraph: an accent rule
         down the side, the text set in the manuscript's own serif, and a copy
         button. */
      return (
        <figure className="relative rounded-md border-l-2 border-accent/50 bg-raised/60 py-2 pr-9 pl-3">
          <div className="flex flex-col gap-1 font-serif leading-relaxed text-fg">
            {block.lines.map((line, i) => (
              <p key={i}>
                <Runs runs={line} />
              </p>
            ))}
          </div>
          <Offered block={block} label="Copy this passage" copyable={copyable}>
            {actions?.(block)}
          </Offered>
        </figure>
      );

    case "code":
      return (
        <figure className="relative">
          {/* `overflow-x-auto` and no wrapping: a snippet re-wrapped at 300px
              is a snippet nobody can read. The rail scrolls it instead. */}
          <pre className="overflow-x-auto rounded-md border border-line bg-raised px-3 py-2 pr-9">
            <code className="font-code text-[0.8125rem] leading-relaxed text-fg">
              {block.text}
            </code>
          </pre>
          <Offered block={block} label="Copy this text" copyable={copyable}>
            {actions?.(block)}
          </Offered>
        </figure>
      );

    case "rule":
      return <hr className="border-line" />;

    default:
      return (
        <p className="leading-relaxed">
          <Runs runs={block.runs} />
        </p>
      );
  }
}

function ListBlock({ ordered, items }: { ordered: boolean; items: Run[][] }) {
  /* `list-outside` with padding rather than `list-inside`: inside, a bullet
     that wraps puts its second line under the marker instead of under the
     first word, which at this width is most of them. */
  const className = `flex flex-col gap-1.5 pl-5 leading-relaxed ${
    ordered ? "list-decimal" : "list-disc"
  } list-outside marker:text-muted`;

  return ordered ? (
    <ol className={className}>
      {items.map((item, i) => (
        <li key={i}>
          <Runs runs={item} />
        </li>
      ))}
    </ol>
  ) : (
    <ul className={className}>
      {items.map((item, i) => (
        <li key={i}>
          <Runs runs={item} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The controls on a block of offered prose.
 *
 * Top right and absolutely placed, which is why both callers reserve `pr-9`:
 * in the flow they would push the words they are about, and these blocks are
 * narrow enough already.
 *
 * `blockText` rather than the raw source, so what lands on the clipboard is the
 * words without the notation — the destination is somebody's novel, and
 * pasting `**bold**` into a manuscript puts asterisks in a book.
 *
 * **`isOffered` is the gate for the whole row, not just for Copy.** It is the
 * one place that decides which blocks are the model *offering text* rather than
 * talking, and an Apply control on a paragraph of commentary would put the
 * model's opinion of a scene into the scene.
 */
function Offered({
  block,
  label,
  copyable,
  children,
}: {
  block: Block;
  label: string;
  copyable: boolean;
  children?: React.ReactNode;
}) {
  if (!isOffered(block)) return null;
  if (!copyable && !children) return null;

  return (
    <div className="absolute top-1 right-1 flex items-center gap-0.5">
      {children}
      {copyable && (
        <CopyButton
          value={blockText(block)}
          label={label}
          className="text-muted hover:bg-raised hover:text-fg"
        />
      )}
    </div>
  );
}

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.mark === "bold" ? (
          <strong key={i} className="font-semibold text-fg">
            {run.text}
          </strong>
        ) : run.mark === "italic" ? (
          <em key={i}>{run.text}</em>
        ) : run.mark === "code" ? (
          <code
            key={i}
            className="rounded bg-raised px-1 py-0.5 font-code text-[0.8125rem]"
          >
            {run.text}
          </code>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  );
}

/**
 * The whole reply as plain prose, for a caller offering "copy all".
 *
 * Exported here rather than in `markdown.ts` because it is a *presentation*
 * question — it is what somebody gets when they copy what they can see, which
 * means the blocks in the order this component drew them.
 */
export function replyText(text: string): string {
  return parseMarkdown(text)
    .map((block) =>
      block.kind === "list"
        ? block.items
            .map((item, i) =>
              block.ordered ? `${i + 1}. ${runsText(item)}` : `- ${runsText(item)}`,
            )
            .join("\n")
        : blockText(block),
    )
    .filter(Boolean)
    .join("\n\n");
}
