import type { Metadata } from "next";
import {
  LegalPage,
  List,
  Note,
  Section,
  Term,
} from "@/components/legal/legal-shell";
import { CONTACT_EMAIL, COUNTRY, OPERATOR, TRADING_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy · OpenChapter",
  description:
    "What OpenChapter stores, what leaves your browser, and who receives it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="Your manuscript is private. This page lists what is stored, what leaves your browser, and who receives it in the launch MVP."
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
          OpenChapter stores your books so you can return later and keep
          writing. We do not sell your data, run advertising trackers, or use
          your writing to train models.
        </p>
        <Note>
          The writing assistant sees the chapter text you send with your
          question. PDF export sends the full book to our server for layout.
          Word and EPUB export are built in the browser.
        </Note>
      </Section>

      <Section title="What is stored on your device">
        <p>
          In your browser storage, OpenChapter keeps working data such as:
        </p>
        <List
          items={[
            "Your local library, books, chapters, titles, order and manuscript text.",
            "Draft setup data while you create a new book.",
            "Editor preferences, theme and writing layout settings.",
            "Local copies needed for fast editing and offline-safe recovery.",
          ]}
        />
      </Section>

      <Section title="What is stored on our servers">
        <p>Only when you sign in or use paid billing:</p>
        <List
          items={[
            <>
              <Term>Your account</Term> — your email address and any profile
              details provided by the sign-in provider.
            </>,
            <>
              <Term>Your library</Term> — books, chapters, prose and metadata,
              synced so the work survives a lost device and follows you to
              another one.
            </>,
            <>
              <Term>Your subscription</Term> — which plan you are on, the
              billing cycle, payment provider identifiers and the paid-up
              period end. We do not receive or store card numbers.
            </>,
            <>
              <Term>Usage counters</Term> — how many assistant replies you have
              used, daily and monthly, so each plan&rsquo;s allowance can be enforced.
            </>,
            <>
              <Term>Feedback you send</Term> — the message, topic and account it
              came from.
            </>,
          ]}
        />
      </Section>

      <Section title="Every time something leaves your browser">
        <List
          items={[
            <>
              <Term>The writing assistant</Term> — when you ask the assistant a
              question, the open chapter and your chat message are sent to the
              configured language-model provider so it can answer. If you have
              turned on letting it write into the chapter and you have a passage
              selected, that passage is sent too, so a replacement it offers
              fits the words it is replacing. Nothing is used for model training
              by us.
            </>,
            <>
              <Term>Dictation</Term> — the microphone buttons use your
              browser&rsquo;s own speech recognition, not ours. While you are
              dictating, the browser sends the audio to its maker&rsquo;s
              service to turn into words; in Chrome that is Google. Nothing is
              sent while it is switched off, and the feature exists only in
              browsers that offer the engine.
            </>,
            <>
              <Term>Making a PDF</Term> — PDF export sends the full typeset book
              to our server so a browser can lay it out and return a PDF. The
              generated file is returned to you and is not stored as a permanent
              file by OpenChapter.
            </>,
            <>
              <Term>Sync</Term> — if you are signed in, your library syncs to
              our database.
            </>,
            <>
              <Term>Payment</Term> — when you subscribe, checkout is handled by
              the payment provider. Card details are entered there, not in
              OpenChapter.
            </>,
          ]}
        />
        <p>
          The launch MVP does not publicly offer the older research, audio,
          collaboration or publishing-workflow tools. Their old API routes are
          hidden for launch by default.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          If you have an account, authentication cookies keep you signed in.
          There are no advertising cookies.
        </p>
      </Section>

      <Section title="How long things are kept">
        <p>
          Your library stays until you delete it or ask us to delete your
          account. Deleting your account removes the account and the data held
          under it.
        </p>
      </Section>

      <Section title="What you can ask for">
        <List
          items={[
            "A copy of your data.",
            "Deletion of your account and synced library.",
            "Correction of account data.",
            "An explanation of anything in this policy.",
          ]}
        />
      </Section>

      <Section title="Children">
        <p>
          This is a tool for authors preparing books for sale, and it is not
          directed at children. Please do not use it if you are under 16.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, this page changes with it. A change that
          affects what leaves your browser will be stated plainly.
        </p>
      </Section>
    </LegalPage>
  );
}
