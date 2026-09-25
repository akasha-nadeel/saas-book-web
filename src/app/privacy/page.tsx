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
          writing. There is no AI in OpenChapter: your writing is never sent to
          a language model, and we do not sell your data or use your writing to
          train anything. We do run one advertising measurement tag, described
          below; it never sees a word of your manuscript.
        </p>
        <Note>
          PDF export sends the full book to our server for layout. Word and
          EPUB export are built in the browser.
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
              <Term>Usage counters</Term> — how many title checks you have run
              today, synced with your other settings so the free plan&rsquo;s
              daily allowance is the same on every device.
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
              <Term>The title check</Term> — the title you type is sent to our
              server, which searches Google Books and Open Library for it and
              returns what they hold. Only the words you typed are sent; none
              of your manuscript goes with them.
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
              <Term>Advertising measurement</Term> — we run search ads, and
              every page carries Google&rsquo;s conversion tag so we can tell
              which advert brought somebody who went on to make an account. It
              reports the page address and the usual details a web request
              carries, and nothing else: not your books, not your chapters, not
              a word you have written. It is the site&rsquo;s only third-party
              script, and it is switched off entirely on any deployment that
              does not set the key for it.
            </>,
            <>
              <Term>Payment</Term> — when you subscribe, checkout is handled by
              the payment provider. Card details are entered there, not in
              OpenChapter.
            </>,
            <>
              <Term>Choosing a plan on the public pricing page</Term> —
              pressing Choose Pro there records the plan, the billing cycle you
              had selected, and which page you pressed it on. That is how we
              tell whether people want the monthly or the annual price before
              they have an account to ask. If you are signed in, your account
              and email address are recorded with it; if you are not, nothing
              that identifies you is. No other detail is taken, and the record
              is not shared with anybody. Pressing the same button from inside
              your account records nothing — it goes straight to checkout.
            </>,
          ]}
        />
        <p>
          The launch MVP does not publicly offer the older research,
          collaboration or publishing-workflow tools. Their old API routes are
          hidden for launch by default. None of them sends your writing to a
          language model either — the routes that did were removed.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          If you have an account, authentication cookies keep you signed in.
          The advertising tag above sets one of its own, in our name rather
          than a third party&rsquo;s, to carry the identifier of the advert you
          clicked from the page you landed on to the page where you sign up —
          which is the whole of what it is for. We run no other advertising
          cookies, and none that follow you to anybody else&rsquo;s site.
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
