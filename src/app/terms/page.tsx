import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Note, Section, Term } from "@/components/legal/legal-shell";
import { displayPrice, priceOf } from "@/lib/billing/plans";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { plural } from "@/lib/plural";
import {
  CONTACT_EMAIL,
  COUNTRY,
  OPERATOR,
  REFUND_DAYS,
  TRADING_NAME,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms · OpenChapter",
  description:
    "The terms of using OpenChapter: your account, your book, the Free and Pro plans, and what each side is responsible for.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="The agreement between you and us. These terms describe the launch MVP: a focused book-writing workspace with Free and Pro plans."
    >
      <Section title="1. Who you are agreeing with">
        <p>
          {TRADING_NAME} is operated by {OPERATOR}, a sole trader in {COUNTRY}.
          &ldquo;We&rdquo; and &ldquo;us&rdquo; mean that person;
          &ldquo;you&rdquo; means whoever is using the service. Using the site or
          app means you accept these terms.
        </p>
      </Section>

      <Section title="2. What the service is">
        <p>
          {TRADING_NAME} is a web application for authors writing books. It
          helps you create and organize books, write chapter by chapter, use a
          focused writing assistant, and export book files. It is software
          delivered over the web. There are no physical goods and nothing is
          shipped.
        </p>
      </Section>

      <Section title="3. Your account">
        <p>
          If you make an account, keep your sign-in details to yourself. You
          are responsible for what happens under your account. Tell us at once
          if you think somebody else has got into it.
        </p>
      </Section>

      <Section title="4. Your book stays yours">
        <p>
          You keep every right you have in what you write. We claim no
          ownership, no licence to publish it, and no share of what it earns.
        </p>
        <Note>
          Nothing you write is used to train any model. Where a feature sends
          text to a third party, the{" "}
          <Link href="/privacy" className="text-lp-accent-text hover:underline">
            privacy policy
          </Link>{" "}
          names the feature, what it sends and who receives it.
        </Note>
      </Section>

      <Section title="5. Free and Pro">
        <p>
          The Free plan includes {plural(LAUNCH_LIMITS.freeBooks, "book")},
          unlimited chapters and words, autosave and sync where accounts are
          configured,{" "}
          {LAUNCH_LIMITS.freeAssistantRepliesPerMonth} writing-assistant
          replies per month, and Word, EPUB and PDF export.
        </p>
        <p>
          Pro includes unlimited books and{" "}
          {LAUNCH_LIMITS.proAssistantRepliesPerMonth} writing-assistant replies
          per month. Every export format is included on both plans.
        </p>
        <p>
          {TRADING_NAME} Pro is {displayPrice(priceOf("monthly"))} a month or{" "}
          {displayPrice(priceOf("annual"))} a year. Both renew automatically
          until cancelled. You can cancel at any time from the account menu; the
          plan then runs to the end of the period you have paid for. Refunds are
          set out on the{" "}
          <Link href="/refunds" className="text-lp-accent-text hover:underline">
            refunds page
          </Link>
          , including a {REFUND_DAYS}-day window on a first payment.
        </p>
        <p>
          Prices and limits can change later. A change never applies to a
          period you have already paid for, and we will say so before the next
          renewal.
        </p>
      </Section>

      <Section title="6. What you must not do">
        <List
          items={[
            "Upload work you do not have the right to use.",
            "Use the service for anything unlawful.",
            "Resell access, share one account between several writers, or run metered features on somebody else's behalf as a service.",
            "Attack the service, automate paid routes, or try to bypass plan checks.",
          ]}
        />
        <p>
          We can suspend or close an account that does these things. If we do,
          you can still ask for your data.
        </p>
      </Section>

      <Section title="7. Services we rely on">
        <p>
          The app uses other companies for hosting, database and sign-in,
          payments, and the language model behind the writing assistant. What
          each one receives is listed in the privacy policy. We choose them and
          we are answerable for them, but we cannot promise the behaviour of a
          service we do not run.
        </p>
      </Section>

      <Section title="8. Availability and backups">
        <p>
          We work to keep the service up and we do not promise it will never be
          down. Maintenance, provider outages and bugs can happen.
        </p>
        <Note>
          <Term>Keep your own copies.</Term> Export exists so your manuscript
          is not trapped in OpenChapter. Word, EPUB and PDF are available on
          every plan, paid or not.
        </Note>
      </Section>

      <Section title="9. Where our responsibility ends">
        <p>
          The service is provided as it is. We do not promise it is free of
          faults, and we are not liable for lost profits, lost sales, rankings
          or lost data beyond what the law requires of us. Nothing here limits
          liability for anything that cannot lawfully be limited.
        </p>
      </Section>

      <Section title="10. Ending it">
        <p>
          You can stop using the service whenever you like, and delete your
          account by writing to us. We can end this agreement if you break these
          terms.
        </p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>
          If these terms change, the date at the top changes with them. A
          change that affects what you pay or what you may do will be stated
          plainly.
        </p>
      </Section>

      <Section title="12. Law and contact">
        <p>
          These terms are governed by the law of {COUNTRY}. Before anything
          formal, write to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-lp-accent-text hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
