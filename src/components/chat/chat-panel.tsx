"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ApplyReview } from "@/components/chat/apply-review";
import { WriteSwitch } from "@/components/chat/write-switch";
import { RailMark } from "@/components/editor/rail-mark";
import {
  AssistantReply,
  replyText,
} from "@/components/ui/assistant-reply";
import { CopyButton } from "@/components/ui/copy-button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { UpgradeDialog } from "@/components/upgrade/upgrade-dialog";
import { displayName, firstNameOf } from "@/lib/account";
import {
  anchorFor,
  applyInsertion,
  applyReplacement,
  countWords,
  insertBelowPos,
  passagePreview,
  type WriteAnchor,
} from "@/lib/editor/assistant-write";
import { useDictation } from "@/lib/editor/use-dictation";
import { usePreservedEditorSelection } from "@/lib/editor/preserved-selection";
import { onFreePlan } from "@/lib/launch";
import { blockText, type Block } from "@/lib/markdown";
import { useAccount } from "@/lib/use-account";
import { useAutoGrow } from "@/lib/use-auto-grow";
import { useChatScroll } from "@/lib/use-chat-scroll";
import { clearChat, keepVersionNow, saveChat, setPref } from "@/lib/library-store";
import { useChat, usePrefs } from "@/lib/use-library";
import { usePlan } from "@/lib/use-plan";

/**
 * The assistant panel.
 *
 * Holds its own conversation per chapter, and — since 2026-09-01 — can put a
 * passage the writer approves into the manuscript.
 *
 * **The rule the write feature is built to keep is the one it looks like it
 * breaks.** The assistant still never changes the book on its own. What it does
 * is offer a passage; the writer chooses where it goes and presses. Three
 * things hold that up, and none of them is a comment:
 *
 * - **`isOffered` is the whole protocol.** The model already puts prose it is
 *   offering in a blockquote — every one of them does, unprompted — and
 *   `markdown.ts` already tells that block apart from commentary. So there is
 *   no tool call, no JSON envelope and no change to what `streamModel` yields;
 *   `AssistantReply` grows a control on the blocks it was already drawing a
 *   Copy button on. It works the same on both providers because it is not a
 *   provider feature.
 * - **Two anchors, both exact.** A replacement lands on the range the writer
 *   selected; an insertion lands after the block their caret is in. Nothing
 *   here searches the manuscript for text the model quoted — a near miss there
 *   is somebody else's paragraph rewritten, which is where this feature fails
 *   in other tools.
 * - **A replacement is shown before it is made.** `ApplyReview` puts the diff
 *   on screen and the caret back on the target; an insertion goes straight in,
 *   because it destroys nothing, and says so with an undo beside it.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** A replacement waiting for the writer to say yes. */
interface PendingReplacement {
  range: { from: number; to: number };
  before: string;
  after: string;
}

const SUGGESTIONS = [
  "What isn't working in this chapter?",
  "Tighten the opening paragraph.",
  "What should happen next?",
];

/** The same three, for a writer who has turned write mode on. */
const WRITE_SUGGESTIONS = [
  "Rewrite the selected passage more tightly.",
  "Write the next paragraph in my voice.",
  "Give me a stronger opening line.",
];

export function ChatPanel({
  chapterId,
  chapterTitle,
  getChapterText,
  editor,
  canWrite,
}: {
  /** What the conversation is filed under — one transcript per chapter. */
  chapterId: string;
  chapterTitle: string;
  /** Read lazily: the chapter is only sent when something is actually asked. */
  getChapterText: () => string;
  /** The live surface. Null while it is starting, and on a screen without one. */
  editor?: Editor | null;
  /**
   * Whether this writer may change this book at all.
   *
   * A viewer on a shared book gets the assistant and none of the write
   * controls, whatever their plan — the same answer `saveBody` and the editor
   * itself give, arrived at from the same `canWriteBook`.
   */
  canWrite: boolean;
}) {
  /**
   * **The transcript is read from the store, not held here.**
   *
   * It was `useState([])`, and this panel unmounts every time it is closed —
   * `LeftPanel` owns its own mounting so it can animate out — so a writer who
   * shut the assistant to look at their chapter came back to an empty panel and
   * had lost the reading they just asked for.
   *
   * `stored` is the conversation as saved; `live` is the one being streamed
   * into, which exists because a reply arrives a token at a time and writing
   * every token to disk would be a write per frame. The live copy wins while it
   * is set and is flushed to the store when the reply finishes.
   */
  const stored = useChat<Message>(chapterId);
  const [live, setLive] = useState<Message[] | null>(null);
  const messages = live ?? stored;
  const setMessages = setLive;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefs = usePrefs();
  const plan = usePlan();
  const [upgrading, setUpgrading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pending, setPending] = useState<PendingReplacement | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  /**
   * **Write mode is three conditions, and all three are about capability rather
   * than about the switch.**
   *
   * `canWrite` is the book's answer and `onFreePlan` the plan's — false while
   * the plan is still unknown, because *not knowing yet is not a reason to
   * refuse*, and the server is the real gate either way. The editor is the
   * third: with no surface there is nowhere for a passage to land.
   */
  const locked = onFreePlan(plan);
  const canOfferWrites = canWrite && !!editor && !locked;
  const writeOn = canOfferWrites && prefs.assistantWrite;

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useChatScroll();
  /* About ten lines of the composer's own type before it stops growing and
     starts scrolling. Five was the first try and it was mean: a writer pasting
     a paragraph they want looked at hit the ceiling halfway through it. Past
     ten the box is taking the panel from the conversation it is a question
     about, which is the other failure. */
  const grow = useAutoGrow(input, 220);

  /**
   * Speak the question instead of typing it.
   *
   * **The browser's own engine, not `/api/transcribe`.** That route takes a
   * finished file and costs money per minute; this is live, free and already on
   * the machine. The app keeps its three audio routes apart on purpose and this
   * is the one that belongs on a text field.
   *
   * Only finished phrases arrive — the hook drops the interim ones, which
   * rewrite themselves as the recogniser reconsiders, and words moving under
   * the eye in a box somebody is reading is worse than a short wait. Appended
   * with a joining space so dictating twice does not run two sentences
   * together.
   */
  const dictation = useDictation((phrase) =>
    setInput((current) => (current ? `${current.trimEnd()} ${phrase}` : phrase)),
  );

  /**
   * The selection, held while the chat box has focus.
   *
   * A writer highlights a paragraph and then types a question, and by the time
   * they press Send the live selection belongs to the textarea. This hook
   * already existed for exactly that — the formatting bar uses it — and its
   * `restore` is what puts the range back before a change is made.
   */
  const selection = usePreservedEditorSelection(editor ?? null);

  /**
   * What the assistant would work on, re-read whenever the writer moves.
   *
   * Held in state rather than read during render because the selection lives in
   * ProseMirror, which React does not watch — and subscribing to
   * `selectionUpdate` is what keeps the strip below honest instead of showing
   * whatever was true when the panel last happened to re-render.
   */
  const [anchor, setAnchor] = useState<WriteAnchor | null>(null);
  useEffect(() => {
    if (!editor || !canOfferWrites) return;
    const read = () => setAnchor(anchorFor(editor));
    read();
    editor.on("selectionUpdate", read);
    editor.on("update", read);
    return () => {
      editor.off("selectionUpdate", read);
      editor.off("update", read);
    };
  }, [editor, canOfferWrites]);

  /* **The `canOfferWrites` test is repeated here rather than cleared in the
     effect above.** Clearing it there would be a `setState` in an effect body
     for a value that is already knowable during render — and a stale anchor is
     harmless as long as nothing reads it while write mode is off, which is what
     this guard is. */
  const selected =
    canOfferWrites && anchor?.kind === "selection" ? anchor : null;

  // Abandon an in-flight reply if the panel closes.
  useEffect(() => () => abortRef.current?.abort(), []);

  /* The undo line is a receipt rather than a state: it says what just happened
     and then gets out of the way. Cleared by the next thing the writer does,
     and on a timer for the case where the next thing is nothing. */
  useEffect(() => {
    if (!applied) return;
    const timer = window.setTimeout(() => setApplied(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [applied]);

  /**
   * Keep this chapter as it stands, before a machine changes it.
   *
   * Undo covers the next few seconds. This covers the hour after, when the
   * writer has kept typing and the change is somewhere up the page — and it is
   * the reason the review card can promise anything. Best-effort by design: a
   * full origin means no version, never a refused change.
   */
  const keepVersion = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    try {
      keepVersionNow(
        chapterId,
        JSON.stringify(editor.getJSON()),
        editor.storage.characterCount.words(),
      );
    } catch {
      // See `keepVersionNow`. A missing version is not worth a failed change.
    }
  }, [editor, chapterId]);

  /** Put the caret back on the passage a control is about, so it can be seen. */
  const showAnchor = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    selection.restore();
    editor.commands.scrollIntoView();
    editor.commands.focus();
  }, [editor, selection]);

  const askToReplace = (block: Block) => {
    if (!editor || !selected) return;
    showAnchor();
    setApplied(null);
    setPending({
      range: { from: selected.from, to: selected.to },
      before: selected.text,
      after: blockText(block),
    });
  };

  const insertBelow = (block: Block) => {
    if (!editor) return;
    const pos = insertBelowPos(editor);
    if (pos === null) return;

    keepVersion();
    if (applyInsertion(editor, pos, blockText(block))) {
      setPending(null);
      setApplied("Put into the chapter.");
    }
  };

  const applyPending = () => {
    if (!editor || !pending) return;
    keepVersion();
    if (applyReplacement(editor, pending.range, pending.after)) {
      setApplied("Passage replaced.");
    }
  };

  /**
   * Throw away the conversation for this chapter.
   *
   * Behind a question since 2026-09-01, because the transcript stopped being
   * scaffolding when it started surviving the panel being closed: a reading a
   * writer asked for an hour ago is still on screen, and one press beside Send
   * took it. The chapter is never touched — which is the thing the dialog has
   * to say, since a button marked Clear sitting next to somebody's manuscript
   * invites exactly that fear.
   */
  const clearConversation = () => {
    abortRef.current?.abort();
    setLive(null);
    clearChat(chapterId);
    setError(null);
    setApplied(null);
  };

  const undoLast = () => {
    if (!editor || editor.isDestroyed) return;
    editor.chain().focus().undo().run();
    setApplied(null);
  };

  const toggleWrite = () => {
    if (!canWrite) return;
    if (locked) {
      // **On the press, never from an effect**, and the switch stayed live so
      // there was a press to refuse. See `WriteSwitch`.
      setUpgrading(true);
      return;
    }
    setPref("assistantWrite", !prefs.assistantWrite);
  };

  /**
   * The controls drawn on a block of offered prose.
   *
   * A function handed to `AssistantReply`, which knows nothing about the editor
   * — it passes the block back and this decides what may be done with it.
   * Undefined while write mode is off, so the reply is exactly what it has
   * always been.
   */
  function offeredActions(block: Block) {
    return (
      <>
        {selected && (
          <ActionButton
            label="Replace the selected passage with this"
            onClick={() => askToReplace(block)}
          >
            Replace
          </ActionButton>
        )}
        <ActionButton
          label="Put this into the chapter below the cursor"
          onClick={() => insertBelow(block)}
        >
          Insert
        </ActionButton>
      </>
    );
  }

  const blockActions = writeOn ? offeredActions : undefined;

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;

    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    setApplied(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          chapter: getChapterText(),
          /* Both sent in write mode only, which is the whole of what the flag
             does on the way out: it asks for a reply shaped so it can be
             applied, and names the passage a replacement would land on. The
             route checks the plan for itself before honouring either. */
          write: writeOn,
          selection: writeOn && selected ? selected.text : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response
          .json()
          .then((d: { error?: string }) => d.error)
          .catch(() => null);
        setError(detail ?? "The assistant is unavailable.");
        // Drop the empty assistant bubble — there is nothing to show in it.
        setMessages(history);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }

      /* **Written once the reply is whole, not while it streams.** A token
         arrives every frame or two and each would be a `localStorage` write and
         a listener fan-out; the live copy carries the conversation until then.
         Handing the store the finished pair and dropping the live copy is what
         puts the two back in step. */
      const finished: Message[] = [
        ...history,
        { role: "assistant", content: reply },
      ];
      saveChat(chapterId, finished);
      setLive(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[chat] failed", err);
      setError("Could not reach the assistant.");
      setMessages(history);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const suggestions = writeOn ? WRITE_SUGGESTIONS : SUGGESTIONS;

  /**
   * The greeting over an empty panel.
   *
   * **The name is used when there is one and left out when there is not** —
   * `displayName` answers "Guest" for a writer with no account, and *"Back at
   * it, Guest"* is worse than no name at all. With no Supabase project
   * configured there are no accounts, which is the common case in development
   * and for a self-hosted copy, so the nameless form is a real state rather
   * than an edge.
   *
   * `firstNameOf` for the reason the header chip uses it: a full name at this
   * size wraps the heading onto two lines.
   */
  const account = useAccount();
  const name = account ? displayName(account) : "Guest";
  const greeting =
    name === "Guest" ? "Back at it" : `Back at it, ${firstNameOf(name)}`;

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="scroll-slim flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="px-1">
            {/* **A greeting rather than an instruction.** The panel opened on
                two paragraphs of terms and conditions — what is sent, what is
                kept — which is the right information and the wrong first thing
                to read every time. Both facts are on `/privacy`.

                Set in the app's own sans, not the manuscript serif: the serif
                is the book's face, and a panel heading wearing it reads as a
                piece of the manuscript that has got loose. */}
            <div className="pt-3 pb-1 text-center">
              <h2 className="font-sans text-lg font-semibold text-fg">
                {greeting}
              </h2>
              <p className="mt-1 font-sans text-sm text-muted">
                Ask about “{chapterTitle}”.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  /* **A light blue plate with near-black type, the same in both
                     themes** — and stated as a fixed pair on purpose, like
                     `--color-sheet`. The chip carries its own ground, so black
                     on light blue is legible on the dark panel and on the light
                     one; letting it follow the theme would make one control
                     look like two. They were `border-line` boxes in `muted`,
                     which is the panel's own quietest treatment — the wrong
                     weight for the only thing on an empty screen that tells a
                     writer what to do next. */
                  className="rounded-md border border-blue-200 bg-blue-100
                             px-3 py-2 text-left font-sans text-sm text-blue-950
                             outline-none transition-colors hover:border-blue-300
                             hover:bg-blue-200 focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  {s}
                </button>
              ))}
            </div>

          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((message, i) =>
              message.role === "user" ? (
                <li
                  key={i}
                  className="flex justify-end"
                >
                  <span className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/20 dark:bg-accent/25 px-3 py-2 font-sans text-sm text-fg">
                    {message.content}
                  </span>
                </li>
              ) : (
                /* **The reply is parsed rather than printed.** It arrives in
                   Markdown — every model answers that way unprompted — so
                   printing it put `* **Tightening:**` on screen with the
                   asterisks in it. `group` is what reveals the copy control
                   below. */
                <li key={i} className="group px-1 font-sans">
                  {message.content ? (
                    <>
                      {/* **The apply controls are drawn on a finished reply
                          only.** A blockquote is a block the moment its first
                          line arrives, so offering Replace mid-stream would be
                          offering half a paragraph — and a writer who took it
                          would be putting an unfinished sentence in a book. */}
                      <AssistantReply
                        text={message.content}
                        actions={
                          busy && i === messages.length - 1
                            ? undefined
                            : blockActions
                        }
                      />
                      {/* **Copy the whole reply**, beside the per-block
                          buttons `AssistantReply` draws on offered prose. The
                          two answer different questions — take this passage,
                          or take all of it — and this one only appears once
                          the reply has finished, since copying a half-written
                          answer is a paste somebody has to redo.

                          Held open on hover, focus *within* (so it can be
                          reached by keyboard), and while it is saying
                          "Copied" — which is why `focus-within` is on the row
                          rather than `focus` on the button. */}
                      {!(busy && i === messages.length - 1) && (
                        <div className="mt-1 flex justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <CopyButton
                            value={replyText(message.content)}
                            label="Copy the whole reply"
                            className="text-muted hover:bg-raised hover:text-fg"
                          />
                        </div>
                      )}
                    </>
                  ) : busy && i === messages.length - 1 ? (
                    <span className="text-sm text-muted">Thinking…</span>
                  ) : null}
                </li>
              ),
            )}
          </ol>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-accent/40 px-3 py-2 font-sans text-sm text-muted">
            {error}
          </p>
        )}
      </div>

      {/* **What the assistant is pointed at, said before it is asked anything.**
          The panel is a rail beside a page that may be scrolled somewhere else
          entirely, so the highlight a writer sees in Notion or Word is not on
          screen here. This is that highlight, in words — and pressing it takes
          the page back to the passage. */}
      {writeOn && (
        <div className="border-t border-line px-3 py-2">
          <button
            type="button"
            onClick={showAnchor}
            className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left
                       font-sans text-xs text-muted outline-none transition-colors
                       hover:bg-raised hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            <span className="mt-px shrink-0 font-medium text-accent">
              {selected ? "Selected" : "At the cursor"}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {selected
                ? `“${passagePreview(selected.text, 60)}” · ${countWords(selected.text)} words`
                : "Select a passage to have it replaced"}
            </span>
          </button>
        </div>
      )}

      {applied && (
        <div className="flex items-center justify-between gap-2 border-t border-line bg-ok-bg/40 px-4 py-2">
          <span className="font-sans text-xs text-fg">{applied}</span>
          <button
            type="button"
            onClick={undoLast}
            className="rounded-md font-sans text-xs font-semibold text-accent
                       outline-none hover:underline focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Undo
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-t border-line px-3 pt-1.5 pb-2"
      >
        {/* **Clear sits above the box and outside it**, because it is the one
            control here that does not act on what is being typed: Send and the
            microphone are about this question, and Clear is about the
            conversation behind it. Inside the box it read as a third way to
            deal with the draft. No border out here — it is alone on its row and
            does not need one to be found. */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setClearing(true)}
            disabled={messages.length === 0}
            className="rounded-md px-2 py-1 font-sans text-xs text-muted
                       outline-none transition-colors disabled:opacity-30
                       hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Clear
          </button>
        </div>

        {/* **One box, not a field and a loose row under it.** The border, the
            radius and the ground are here rather than on the textarea, and the
            controls sit inside at the foot — so the whole thing reads as one
            surface a question is composed on, and `focus-within` lights all of
            it rather than just the words.

            `@container` so the switch's label can stand down on the narrowest
            panel: at `--sidebar-width: 15rem` the switch, its label, the chip,
            the microphone and Send do not fit on one line together. */}
        {/* **White, and lifted off the panel with a shadow.**

            `bg-surface` was the panel's own field treatment, and inside
            `.panel-chrome` in daylight that token is re-pointed to a 5% dark
            tint — fields there "lift *down* into the page, because a lighter
            box on a white ground is not a box at all". A shadow is the other
            way to make it one, and it is the one this composer wants: it is not
            a field in a list of fields, it is the surface the whole panel is
            for.

            So `panel` (white in daylight) with the shadow, and `surface` at
            night — where that token is an 8% white lift and the hairline does
            the work, since a shadow on near-black is invisible. Same rule the
            theme blocks follow everywhere else: light lifts with shadow, dark
            lifts with a line. */}
        <div
          className="@container rounded-lg border border-line bg-panel
                     shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.07)]
                     transition-colors focus-within:border-accent
                     dark:bg-surface dark:shadow-none"
        >
          {/* **One line to start, growing to about ten.** It was `rows={3}`:
              three lines of empty box at the foot of a 240px rail, for a
              question most writers type in one — and still three lines for the
              writer who types eight, which scrolls a box they are looking at
              instead of opening it. `useAutoGrow` measures on every change of
              the value, so it also shrinks back when `send` empties the field. */}
          <textarea
            ref={grow}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a newline, as in every chat box.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Ask about this chapter…"
            rows={1}
            /* Borderless and transparent: the box around it owns all of that
               now, and a second border here would draw a field inside a field.

               No `overflow-` class either — the hook owns it, so the scrollbar
               arrives in the same frame the box stops growing and never before.
               `scroll-slim` is what it arrives as: the app's own thin bar, a
               floating pale thumb on no track at all, the same one the message
               list above uses. Without it the browser draws its native bar — on
               Windows a wide grey gutter with arrow buttons at both ends, the
               loudest thing in a panel whose subject is prose. */
            className="scroll-slim w-full resize-none bg-transparent px-3 pt-2
                       pb-1 font-sans text-sm text-fg placeholder:text-muted
                       focus:outline-none"
          />

          <div className="flex items-center justify-between gap-2 px-2 pt-0.5 pb-2">
            {/* Absent rather than locked for a reader on somebody else's book:
                a plan is something you can buy your way past and a viewer role
                is not, so offering the upgrade there would be a false way
                out. */}
            <div className="flex min-w-0 items-center">
              {canWrite && editor && (
                <WriteSwitch
                  on={prefs.assistantWrite}
                  locked={locked}
                  onToggle={toggleWrite}
                />
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {/* **Dictation, and hidden outright where it cannot work.** The
                  engine is the browser's own — Chrome and Edge only — so a
                  control that could never work on this machine is not drawn at
                  all rather than drawn dead.

                  This is deliberately not `/api/transcribe`: that one takes a
                  finished file and costs per minute, and streaming a live
                  microphone at it to watch words appear would be the wrong
                  trade in both directions. */}
              {dictation.supported && (
                <button
                  type="button"
                  onClick={() =>
                    dictation.listening ? dictation.stop() : dictation.start()
                  }
                  aria-pressed={dictation.listening}
                  /* **No tooltip on this one, so the label has to be here.**
                     The card is gone by choice — the microphone is a familiar
                     glyph and a hover panel over the composer was more than it
                     needed — but a button with no text and no `aria-label` is
                     announced to a screen reader as a button called nothing.
                     Same reason `icon-rail.tsx` gives for its own. */
                  aria-label={
                    dictation.listening
                      ? "Stop dictating"
                      : "Dictate — speak and the words are typed"
                  }
                  className={`group relative flex h-8 w-8 items-center justify-center
                              rounded-md outline-none transition-colors
                              focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                dictation.listening
                                  ? "bg-danger/15 text-danger"
                                  : "text-muted hover:bg-raised hover:text-fg"
                              }`}
                >
                  {/* A ring while it is live, so the state is visible from
                      across the room — this is a control a writer turns on and
                      then stops looking at. */}
                  <span className="relative flex items-center justify-center">
                    {dictation.listening && (
                      <span
                        aria-hidden="true"
                        className="absolute -inset-1.5 animate-ping rounded-full bg-danger/40"
                      />
                    )}
                    <RailMark mark="mic" size={18} />
                  </span>
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-md bg-accent px-3 py-1.5 font-sans text-sm
                           font-semibold text-accent-ink outline-none transition-colors
                           disabled:opacity-30 hover:bg-accent-strong
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                {busy ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {pending && (
        <ApplyReview
          before={pending.before}
          after={pending.after}
          onApply={applyPending}
          onClose={() => setPending(null)}
        />
      )}

      {clearing && (
        <ConfirmDialog
          title="Clear this conversation?"
          body={
            <>
              Everything you have asked about “{chapterTitle}” goes, along with
              the assistant&rsquo;s answers. <strong>Your chapter is not
              touched</strong>, and anything you have already put into it stays
              where it is.
            </>
          }
          confirmLabel="Clear"
          onConfirm={clearConversation}
          onClose={() => setClearing(false)}
        />
      )}

      {upgrading && (
        <UpgradeDialog
          reason="assistant-write"
          onClose={() => setUpgrading(false)}
        />
      )}
    </div>
  );
}

/** One control in the row on a block of offered prose, sized to sit beside Copy. */
function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded px-1.5 py-1 font-sans text-[0.6875rem] font-semibold
                 text-muted outline-none transition-colors hover:bg-raised
                 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      {children}
    </button>
  );
}
