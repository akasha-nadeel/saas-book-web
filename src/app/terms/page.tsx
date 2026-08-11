import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, Note, Section, Term } from "@/components/legal/legal-shell";
import { displayPrice, priceOf } from "@/lib/billing/plans";
import { FREE_LIMITS } from "@/lib/free-limits";
import {
  CONTACT_EMAIL,
  COUNTRY,
  OPERATOR,
  REFUND_DAYS,
  TRADING_NAME,
} from "@/lib/legal";

/**
 * The terms of service.
 *
 * **The prices and the free limits are imported, never retyped.** The pricing
 * page, the in-app limit notices and this page have to agree, and the way they
 * agree is by reading the same two modules — a price written out by hand here
 * would be the one figure nobody updates, on the one page a customer quotes
 * back at you in a dispute.
 */

export const metadata: Metadata = {
  title: "Terms · OpenChapter",
  description:
    "The terms of using OpenChapter: your account, your book, the free and paid plans, and what each side is responsible for.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      intro="The agreement between you and us. Plain words, and no clause that contradicts what the software actually does."
    >
      <Section title="1. Who you are agreeing with">
        <p>
          {TRADING_NAME} is operated by {OPERATOR}, a sole trader in {COUNTRY}.
          &ldquo;We&rdquo; and &ldquo;us&rdquo; mean that person;
          &ldquo;you&rdquo; means whoever is using the service. Using the site or
          the app means you accept these terms.
        </p>
      </Section>

      <Section title="2. What the service is">
        <p>
          {TRADING_NAME} is a web application for authors publishing their own
          books: writing and organising a manuscript, checking a finished book
          against what online bookstores require, exporting it to EPUB, DOCX,
          Markdown and PDF, and working through the steps of publishing it. It
          is software delivered over the web. There are no physical goods and
          nothing is shipped.
        </p>
      </Section>

      <Section title="3. Your account">
        <p>
          An account is optional — the app runs in your browser without one. If
          you make one, keep your sign-in details to yourself; you are
          responsible for what happens under your account. Tell us at once if
          you think somebody else has got into it.
        </p>
      </Section>

      <Section title="4. Your book stays yours">
        <p>
          You keep every right you have in what you write. We claim no
          ownership, no licence to publish it, and no share of what it earns.
        </p>
        <Note>
          Nothing you write is used to train any model. The assistant reads and
          reports; it never writes into your book. Where a feature does send
          text to a third party, the{" "}
          <Link href="/privacy" className="text-lp-accent-text hover:underline">
            privacy policy
          </Link>{" "}
          names the feature, what it sends and who receives it.
        </Note>
      </Section>

      <Section title="5. Free and paid">
        <p>
          Writing, importing, all four export formats, sync, the pre-upload
          check and the publishing roadmap are free and stay free. Each research
          tool has its own free allowance — {FREE_LIMITS.comps.free} comparable-title
          searches and {FREE_LIMITS.titleCheck.free} title checks a day,{" "}
          {FREE_LIMITS.covers.free} cover searches a day, the blurb on{" "}
          {FREE_LIMITS.blurb.free} books, the prose report on{" "}
          {FREE_LIMITS.prose.free}, money tracking on {FREE_LIMITS.track.free},{" "}
          {FREE_LIMITS.arcReaders.free} advance readers on each book, and{" "}
          {FREE_LIMITS.keywordsAi.free} sets of keyword suggestions and{" "}
          {FREE_LIMITS.blurbChat.free} blurb conversations in total. The daily
          ones start again the next day; the keyword suggestions and the blurb
          conversations do not, and are the allowances here that do not return.
          The paid plan lifts all of them and adds the tools listed on the
          pricing page.
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
          Prices can change. A change never applies to a period you have already
          paid for, and we will say so before the next renewal.
        </p>
      </Section>

      <Section title="6. What you must not do">
        <List
          items={[
            "Upload work you do not have the right to — somebody else's manuscript, or a book you do not hold the rights in.",
            "Use it for anything unlawful, or for content that would be illegal to publish where you are.",
            "Resell access, share one account between several writers, or run the metered features on somebody else's behalf as a service.",
            "Attack the service: automated hammering of the paid routes, attempts to get past the plan checks, or anything aimed at other people's accounts.",
          ]}
        />
        <p>
          We can suspend or close an account that does these things. If we do,
          you can still ask for your data — see the privacy policy.
        </p>
      </Section>

      <Section title="7. Services we rely on">
        <p>
          The app uses other companies for the parts it does not run itself:
          hosting, the database and sign-in, a payment provider, the language
          model behind the assistant and the research tools, the speech and
          transcription providers behind the two audio features, and two free
          book catalogues. What each one receives is listed in the privacy
          policy. We choose them and we are answerable for them, but we cannot
          promise the behaviour of a service we do not run.
        </p>
      </Section>

      <Section title="8. Availability, and your own copy">
        <p>
          We work to keep the service up and we do not promise it will never be
          down. Maintenance, a provider&rsquo;s outage and plain bugs all
          happen.
        </p>
        <Note>
          <Term>Keep your own copies.</Term> Export is free, unlimited and works
          offline for exactly this reason. A book that exists only in one
          browser is one cleared cache from being gone, and a book that exists
          only on our servers depends on us still being here.
        </Note>
      </Section>

      <Section title="9. Where our responsibility ends">
        <p>
          The service is provided as it is. We do not promise it is free of
          faults, and we are not liable for lost profits, lost sales, lost
          rankings or lost data beyond what the law requires of us. Nothing here
          limits liability for anything that cannot lawfully be limited.
        </p>
        <p>
          What the app reports about your book — what a shop would refuse, what
          a category holds, what a comparable title is — is information to work
          from, not a guarantee about any shop&rsquo;s decision. The shops make
          their own rules and change them.
        </p>
      </Section>

      <Section title="10. Ending it">
        <p>
          You can stop using the service whenever you like, and delete your
          account by writing to us. We can end this agreement if you break these
          terms. If we ever shut the service down we will give notice and leave
          the exports working, because the exports are how you leave with
          everything.
        </p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>
          If these terms change, the date at the top changes with them. A change
          that affects what you pay or what you may do will be stated plainly
          rather than buried.
        </p>
      </Section>

      <Section title="12. Law, and how to reach us">
        <p>
          These terms are governed by the law of {COUNTRY}. Before anything
          formal, write to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-lp-accent-text hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          — most of what looks like a dispute is a misunderstanding that an
          email settles.
        </p>
      </Section>
    </LegalPage>
  );
}
