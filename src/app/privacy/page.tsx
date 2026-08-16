import type { Metadata } from "next";
import {
  LegalPage,
  List,
  Note,
  Section,
  Term,
} from "@/components/legal/legal-shell";
import { CONTACT_EMAIL, COUNTRY, OPERATOR, TRADING_NAME } from "@/lib/legal";

/**
 * The privacy policy.
 *
 * **It is written from the code, feature by feature, and that is the only way
 * it stays true.** A generic policy says "we may share data with third-party
 * service providers", which is both unfalsifiable and useless to the one reader
 * who matters here — a novelist deciding whether an unfinished manuscript is
 * safe on this machine. So every route that sends anything is named, with what
 * it sends and who receives it.
 *
 * That list is a maintenance obligation: **add a route that leaves the browser
 * and add it here.** The same rule the feedback dialog follows for its own
 * fields, and the comps screen for the prose it sends.
 */

export const metadata: Metadata = {
  title: "Privacy · OpenChapter",
  description:
    "What OpenChapter stores, what leaves your browser, and who receives it — named feature by feature.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="Your manuscript lives in your browser. This page lists every occasion something leaves it, what is sent, and who receives it."
    >
      <Section title="Who this is">
        <p>
          {TRADING_NAME} is run by {OPERATOR}, a sole trader in {COUNTRY}. Any
          question about this policy, or any request about your own data, goes
          to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-lp-accent-text hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="The short version">
        <p>
          The app is built to run on your own machine. Your books, your
          chapters, your prose, your notes and your cover artwork are stored by
          your browser, on your computer. Opening a book, writing in it,
          searching it, reading it back and exporting it to any of the four
          formats all happen without a single word of the manuscript leaving the
          device.
        </p>
        <Note>
          There is no analytics, no tracking pixel, no advertising network and
          no third-party script anywhere on this site. Nothing you write is used
          to train any model, by us or by anybody we send data to.
        </Note>
      </Section>

      <Section title="What is stored on your own device">
        <p>
          In your browser&rsquo;s local storage and, for cover artwork, its
          IndexedDB:
        </p>
        <List
          items={[
            "Your books and their chapters — titles, order, word counts, and the text of everything you write.",
            "Notes, bookmarks, ideas, your story bible, and the version history the editor keeps as a safety net.",
            "Cover images, page setup and typography settings, and your preferences — theme, paper, focus mode.",
            "The working data of the per-book tools: your advance-reader list, your ledger, your writing record.",
          ]}
        />
        <p>
          Clearing your browser&rsquo;s data for this site removes all of it. If
          you are not signed in, that is the only copy there is — which is why
          the app makes exporting free and unlimited.
        </p>
      </Section>

      <Section title="What is stored on our servers">
        <p>
          Only if you make an account. Accounts are optional; the app works
          without one.
        </p>
        <List
          items={[
            <>
              <Term>Your account</Term> — your email address, and, if you signed
              in with Google, the name and profile picture Google hands over. We
              never see your password: sign-in is handled by our authentication
              provider.
            </>,
            <>
              <Term>Your library</Term> — so it survives a lost laptop and
              follows you to a second machine. That means the books, chapters,
              prose, notes, cover thumbnails and listing details you have
              written, held in a Postgres database run by Supabase.
            </>,
            <>
              <Term>Your subscription</Term> — whether you are on the paid plan,
              which cycle, and when the paid-up period ends. We never receive or
              store your card details; those go to the payment provider and stay
              there.
            </>,
            <>
              <Term>Feedback you send</Term> — the message, the topic you chose
              and the account it came from. Nothing about your book: not the
              title, not the word count, and deliberately not the page you were
              on, because a page address here contains book and chapter
              identifiers.
            </>,
          ]}
        />
        <p>
          Database access is restricted per row, so your books are readable by
          your account and by anybody you have explicitly invited to a book —
          nobody else.
        </p>
      </Section>

      <Section title="Every time something leaves your browser">
        <p>
          These are the whole list. Each happens only when you use that feature,
          and most of them only when you press a button.
        </p>
        <List
          items={[
            <>
              <Term>The writing assistant</Term> — the text of the chapter you
              have open, when you open the assistant panel and ask it something.
              Sent to Anthropic, who process it to answer and do not train on
              it.
            </>,
            /* Narration (text → speech) was listed here and came off with the
               feature on 2026-08-14. The route is still in the tree but nothing
               can reach it, so nothing is sent — and a privacy page naming a
               transfer that cannot happen is as wrong as one that misses a
               transfer that can. Put both back together. */
            <>
              <Term>Transcription (audiobook import)</Term> — the audio file you
              choose, sent to a transcription provider through the same gateway.
            </>,
            <>
              <Term>Comparable titles</Term> — a search query built from your
              book&rsquo;s genre and blurb, sent to Google Books and Open
              Library. The manuscript is not sent.
            </>,
            <>
              <Term>Category suggestions</Term> — the characters you type into
              the category box, sent to Open Library&rsquo;s subject index.
            </>,
            <>
              <Term>Search-query help and category translation</Term> — the
              words in the search box and your chosen genre, or a list of
              subject names and their sizes. Sent to a language model. Your book
              is not.
            </>,
            <>
              <Term>Keyword suggestions</Term> — the description you typed, your
              genre, the categories you chose, and your title, author and series
              names so the suggestions can avoid words the shop already indexes.
              Sent to a language model when you press &ldquo;Suggest
              keywords&rdquo;. No part of the manuscript goes.
            </>,
            <>
              <Term>Talking through your keywords</Term> — the conversation you
              type, plus the same fields as above and the seven boxes as they
              stand, sent to a language model when you send a message. No part
              of the manuscript goes.
            </>,
            <>
              <Term>Ranking comparable titles</Term> — this one sends prose.
              Your blurb and the <em>opening</em> of your manuscript, capped at
              a couple of pages and cut at a paragraph, go with the list of
              books the catalogues returned, because whether a book sounds like
              another cannot be answered from keywords. It goes only when you
              press the button, and the screen lists exactly what will be sent
              before you press it.
            </>,
            <>
              <Term>Working on your blurb</Term> — this one sends prose. The
              conversation you type, your draft, title and genre, and the{" "}
              <em>opening</em> of your first chapter, capped at a few pages and
              cut at a paragraph, so the description sounds like the book. The
              rest of the manuscript never goes, and neither does your ending.
              It goes only when you send a message, and the panel names exactly
              what will be sent before you do.
            </>,
            <>
              <Term>Reading your blurb</Term> — the description you typed, your
              title and your genre, sent to a language model when you press
              &ldquo;Ask a reader&rdquo;. It answers with what a reader would
              still be asking; it does not write a description for you, and it
              is not sent any part of the manuscript.
            </>,
            /* Added 2026-08-16, and it is the largest transfer on this list —
               the whole typeset book rather than an opening or a form field.
               It is named first among the exports for that reason, and the
               export screen says the same thing before the button. */
            <>
              <Term>Making a PDF</Term> — this one sends the whole book. The
              typeset text of every chapter and every picture in it goes to our
              server, where a browser lays it out on pages and sends the
              finished PDF straight back. It is the only way the page numbers
              on your contents page can be right, and it is the only route here
              that carries a complete manuscript. Nothing is written down: the
              file is built, returned, and the browser it was built in is
              closed. Your EPUB, Word file and Markdown are made entirely in
              your own browser and send nothing at all.
            </>,
            <>
              <Term>Sync</Term> — if you are signed in, your library as
              described above, to our database.
            </>,
            /* Added with invitation email on 2026-08-14. This is the first
               transfer here about somebody who is *not* the writer, so it names
               whose address it is and what the recipient can do about it. The
               manuscript is deliberately absent from the list, and stays
               absent. */
            <>
              <Term>Inviting a co-writer</Term> — when you invite someone to a
              book, their email address, the book&rsquo;s title, your name and
              email address, and any message you add are sent to our email
              provider so the invitation can be delivered. No part of the
              manuscript goes. Replies go to your address rather than ours. If
              they do nothing, the invitation expires and no account is created
              for them.
            </>,
            <>
              <Term>Payment</Term> — when you subscribe, you are handed to our
              payment provider&rsquo;s own page. Your card details are entered
              there and never pass through us.
            </>,
          ]}
        />
        <p>
          Everything else — writing, importing, page setup, the pre-upload
          check, the roadmap, the structure and progress tools, and every
          export format — runs entirely in your browser.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          One kind, and only if you have an account: the session cookie that
          keeps you signed in, set by our authentication provider and refreshed
          as you use the app. There are no analytics cookies and no advertising
          cookies, because there is no analytics and no advertising. Typefaces
          are served from this domain rather than from a font network, so
          loading a page tells nobody else that you did.
        </p>
      </Section>

      <Section title="How long things are kept">
        <p>
          Your library stays until you delete it. Deleting a chapter puts it in
          that book&rsquo;s trash, where it stays until you empty it; emptying
          the trash removes the text for good. Deleting your account removes
          your account and everything stored under it.
        </p>
      </Section>

      <Section title="What you can ask for">
        <List
          items={[
            <>
              <Term>A copy of everything</Term> — you already have it. Export
              any book to EPUB, DOCX or PDF, free and without a limit,
              at any time.
            </>,
            <>
              <Term>Deletion</Term> — email us and we will delete your account
              and everything held under it.
            </>,
            <>
              <Term>Correction, or a question about any of the above</Term> —
              same address.
            </>,
          ]}
        />
        <p>
          Requests are answered from the address at the top of this page. We may
          ask you to write from the address the account uses, since that is the
          only way to know the request is yours.
        </p>
      </Section>

      <Section title="Children">
        <p>
          This is a tool for authors preparing books for sale, and it is not
          directed at children. Please do not use it if you are under 16.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, the date at the top changes with it. A change
          that affects what leaves your browser will be stated plainly on this
          page rather than folded into a paragraph.
        </p>
      </Section>
    </LegalPage>
  );
}
