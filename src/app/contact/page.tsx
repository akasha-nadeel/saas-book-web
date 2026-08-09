import type { Metadata } from "next";
import { LegalPage, List, Section, Term } from "@/components/legal/legal-shell";
import {
  CONTACT_EMAIL,
  COUNTRY,
  OPERATOR,
  OPERATOR_SHORT,
  REPLY_DAYS,
  TRADING_NAME,
} from "@/lib/legal";

/**
 * Where to find a human.
 *
 * **A payment provider's reviewer checks for this page specifically**, and what
 * they are checking is that a customer with a complaint can reach somebody
 * before they reach their bank. So: one address, who answers it, how long it
 * takes, and no form — a contact form that silently fails is worse than a
 * mailto that cannot.
 *
 * If a provider asks for a postal address as well (some require one for the
 * card networks), it goes here rather than in a second place.
 */

export const metadata: Metadata = {
  title: "Contact · OpenChapter",
  description: "How to reach the person who builds and runs OpenChapter.",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact"
      intro="One address, and a person on the other end of it."
    >
      <Section title="Email">
        <p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-sans text-lg text-lp-accent-text hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p>
          Answered by {OPERATOR_SHORT}, who builds {TRADING_NAME}, within{" "}
          {REPLY_DAYS} working days. There is no support team and no ticket
          queue — it is one person, which is slower on a Sunday and considerably
          more useful on a Tuesday.
        </p>
      </Section>

      <Section title="What to write about">
        <List
          items={[
            <>
              <Term>Anything that is broken.</Term> Say which book and what you
              pressed. If an export produced a file a shop refused, keep the
              shop&rsquo;s message — it is usually the whole diagnosis.
            </>,
            <>
              <Term>Billing, cancelling and refunds.</Term> Write from the
              address on the account.
            </>,
            <>
              <Term>Your data.</Term> A copy, a correction, or deleting the
              account and everything under it.
            </>,
            <>
              <Term>What is missing.</Term> Most of what this app does started
              as somebody describing a problem nobody had built for.
            </>,
          ]}
        />
        <p>
          There is also a feedback box inside the app, under the account menu.
          It sends your message and nothing about your book — no title, no word
          count, not even the page you were on.
        </p>
      </Section>

      <Section title="Who runs this">
        <p>
          {TRADING_NAME} is operated by {OPERATOR}, a sole trader in {COUNTRY}.
        </p>
      </Section>
    </LegalPage>
  );
}
