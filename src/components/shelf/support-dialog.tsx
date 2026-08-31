"use client";

import { Button } from "@/components/ui/button";
import { DialogClose, Divider, Shell } from "@/components/ui/dialog";

/**
 * Where a stuck writer goes.
 *
 * OpenChapter has no support desk — no server, no accounts, nothing to open a
 * ticket against. Rather than a dead "Contact us" that leads nowhere, this is
 * honest self-help: the guide, the Assistant, and the two things that actually
 * go wrong with a browser-local app. Point it at a real channel once one exists.
 *
 * On `Shell` rather than its own `<dialog>`, which it had only to set a width.
 * The cost of that copy was `oc-dialog-scroll` and `data-dialog-presentation`,
 * so on a phone this was a floating box rather than the bottom sheet every
 * other dialog becomes.
 */
export function SupportDialog({ onClose }: { onClose: () => void }) {
  return (
    <Shell onClose={onClose} width="w-[32rem]">
      <DialogClose onClose={onClose} />

      <h2 className="pr-8 font-serif text-xl text-tremor-content-strong">
        Getting help
      </h2>

      <p className="mt-2 font-sans text-sm leading-6 text-tremor-content">
        OpenChapter runs entirely in this browser — there is no support desk
        yet. Here is how to get unstuck:
      </p>

      <ul className="mt-4 space-y-3 font-sans text-sm leading-6 text-tremor-content">
        <li>
          <span className="font-medium text-tremor-content-strong">
            Learn the app.
          </span>{" "}
          The Help guide lists everything OpenChapter can do.
        </li>
        <li>
          <span className="font-medium text-tremor-content-strong">
            Ask the Assistant.
          </span>{" "}
          In the editor, it answers questions about the chapter you are writing.
        </li>
        <li>
          <span className="font-medium text-tremor-content-strong">
            Missing books?
          </span>{" "}
          Your library is tied to this browser and profile. If books seem to
          vanish, check you are in the same browser you wrote them in and that
          browsing data was not cleared — and export regularly to keep backups.
        </li>
        <li>
          <span className="font-medium text-tremor-content-strong">
            Assistant silent?
          </span>{" "}
          It needs a model key on the server — either an ANTHROPIC_API_KEY or a
          GOOGLE_GENERATIVE_AI_API_KEY; without one it says so.
        </li>
      </ul>

      <Divider />

      <div className="oc-dialog-actions flex justify-end">
        <Button onClick={onClose}>Back to writing</Button>
      </div>
    </Shell>
  );
}
