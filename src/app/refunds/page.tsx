import type { Metadata } from "next";
import { LegalPage, List, Note, Section, Term } from "@/components/legal/legal-shell";
import { displayPrice, priceOf } from "@/lib/billing/plans";
import { CONTACT_EMAIL, REFUND_DAYS, REPLY_DAYS, TRADING_NAME } from "@/lib/legal";

/**
 * The refund and cancellation policy.
 *
 * **Every sentence here has to match what the code does**, because this is the
 * page a customer quotes when they are already annoyed. Two facts do the work
 * and both are in `subscription.ts`: cancelling stops the *renewal* and does
 * not revoke anything, and a cancelled plan runs to its `current_period_end`
 * with no grace beyond it. A page promising an instant cut-off, or promising
 * pro-rata, would be describing software that does not exist.
 *
 * The {REFUND_DAYS}-day window is a business decision rather than a technical
 * one — nothing enforces it in code, it is honoured by hand from the mailbox.
 * It is here because a payment provider's reviewer looks for a stated window,
 * and because a policy of "no refunds ever" on a subscription invites the
 * chargebacks it was written to avoid.
 */

export const metadata: Metadata = {
  title: "Refunds & cancellation · OpenChapter",
  description:
    "How to cancel OpenChapter Pro, what happens when you do, and when we refund.",
};

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refunds and cancellation"
      intro="Cancel whenever you like, keep what you have paid for until it runs out, and ask for your money back within the first week if it was not for you."
    >
      <Section title="Cancelling">
        <p>
          Open the account menu and press <Term>Cancel subscription</Term>. That
          is the whole of it — no email, no form, no notice period.
        </p>
        <List
          items={[
            "The renewal stops. Your card is not charged again.",
            "Your plan keeps running to the end of the period you have already paid for. The account menu shows that date.",
            "When the date passes, the account goes back to the free plan. Nothing is deleted — every book, chapter and word stays exactly where it was.",
            "Exports stay free and unlimited on the free plan, so you can always take everything with you.",
          ]}
        />
        <Note>
          If the Cancel button is not in your account menu, write to{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-lp-accent-text hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          and we will cancel it for you the same way.
        </Note>
      </Section>

      <Section title={`Refund on a first payment — ${REFUND_DAYS} days`}>
        <p>
          If {TRADING_NAME} Pro is not what you expected, ask within{" "}
          {REFUND_DAYS} days of your <em>first</em> payment and we will refund
          it in full. You do not have to give a reason.
        </p>
        <p>
          That applies to both cycles — {displayPrice(priceOf("monthly"))}{" "}
          monthly and {displayPrice(priceOf("annual"))} annual.
        </p>
      </Section>

      <Section title="Renewals">
        <p>
          Payments after the first are not refunded, because cancelling before
          the renewal date is free and takes one press. The date is shown in
          your account menu the whole time you are subscribed.
        </p>
        <p>
          One exception, and we would rather say it than argue about it later:
          if you were charged for a period you plainly did not use — you had not
          signed in at all — write to us. We would rather refund that than keep
          it.
        </p>
      </Section>

      <Section title="If something we charge for is broken">
        <p>
          If a paid feature does not work and we cannot fix it in reasonable
          time, tell us and we will refund the period it spoiled. That is not
          conditional on the {REFUND_DAYS} days above.
        </p>
      </Section>

      <Section title="How to ask">
        <p>
          Email{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-lp-accent-text hover:underline"
          >
            {CONTACT_EMAIL}
          </a>{" "}
          from the address on the account, and say which payment you mean. We
          answer within {REPLY_DAYS} working days.
        </p>
        <p>
          Approved refunds go back to the card that paid, through the payment
          provider. How quickly it appears is your bank&rsquo;s decision rather
          than ours — usually 5 to 10 working days.
        </p>
      </Section>

      <Section title="What a refund does not do">
        <p>
          It does not delete your books. Refunding a subscription returns the
          money and returns the account to the free plan; everything you have
          written stays, and you can go on writing, importing and exporting on
          the free plan for as long as you like.
        </p>
      </Section>
    </LegalPage>
  );
}
