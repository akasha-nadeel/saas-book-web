"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * The billing details, and the form that carries them to PayHere.
 *
 * A plain HTML form POSTing straight to PayHere's checkout — no fetch, no SDK,
 * no redirect of our own. That is PayHere's documented shape and it is also the
 * sturdiest one available: the browser navigates away in a single step, so
 * there is no window in which the app thinks a payment has started and PayHere
 * has never heard of it.
 *
 * The hidden fields arrive already signed from the server. Nothing in here may
 * be trusted to be what it says — a determined reader can edit the amount in
 * devtools — but the hash covers the merchant id, the order, the amount and the
 * currency, so an edited field simply fails PayHere's own check. The visible
 * fields are not signed and do not need to be: they are the writer's own name
 * and address, and lying about them only inconveniences the writer.
 */

export function CheckoutForm({
  action,
  sandbox,
  summary,
  email,
  fields,
}: {
  /** PayHere's checkout URL — sandbox or live, decided on the server. */
  action: string;
  sandbox: boolean;
  summary: { item: string; price: string; cycle: string };
  email: string;
  fields: Record<string, string>;
}) {
  // Guards against a double-post on a slow connection: the form leaves the page
  // when it submits, so this only ever goes one way.
  const [leaving, setLeaving] = useState(false);

  return (
    // <body> is overflow-hidden for the editor shell, so a standalone page owns
    // its own scrolling. min-h-dvh would put the button out of reach.
    <main className="scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface pb-(--oc-safe-bottom)">
      <div className="px-5 pt-5">
        <Link
          href="/upgrade"
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5
                     font-sans text-sm text-muted outline-none transition-colors
                     hover:bg-raised hover:text-fg focus-visible:ring-2
                     focus-visible:ring-accent/60"
        >
          <span aria-hidden="true">←</span> Back to plans
        </Link>
      </div>

      <div className="mx-auto max-w-lg px-5 pt-8 pb-20">
        <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
          Checkout
        </h1>

        <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-sans text-sm font-medium text-fg">
              {summary.item}
            </span>
            <span className="font-display text-xl font-semibold text-fg">
              {summary.price}
            </span>
          </div>
          <p className="mt-1.5 font-sans text-xs text-muted">
            Charged once {summary.cycle}, renewing until you cancel.
          </p>
        </div>

        {sandbox && (
          // Not decoration. A test card charged on a live merchant and a real
          // card charged on a sandbox one look identical up to the moment the
          // statement arrives, so which one this is gets said out loud.
          <p
            className="mt-4 rounded-xl border border-line bg-raised px-4 py-3
                       font-sans text-xs leading-relaxed text-muted"
          >
            <span className="font-medium text-fg">Sandbox.</span>{" "}
            This is PayHere&rsquo;s test gateway — no money moves, and only test
            cards are accepted.
          </p>
        )}

        <form
          action={action}
          method="post"
          onSubmit={() => setLeaving(true)}
          className="mt-8"
        >
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <h2 className="font-sans text-sm font-semibold text-fg">
            Billing details
          </h2>
          <p className="mt-1 font-sans text-xs leading-relaxed text-muted">
            PayHere requires these for the receipt. They go to PayHere with the
            payment and are not stored by OpenChapter.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field name="first_name" label="First name" autoComplete="given-name" />
            <Field name="last_name" label="Last name" autoComplete="family-name" />
          </div>

          <div className="mt-4">
            <Field
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              defaultValue={email}
            />
          </div>

          <div className="mt-4">
            <Field
              name="phone"
              label="Phone"
              type="tel"
              autoComplete="tel"
              hint="With the country code, e.g. +94 71 234 5678"
            />
          </div>

          <div className="mt-4">
            <Field name="address" label="Address" autoComplete="street-address" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field name="city" label="City" autoComplete="address-level2" />
            <Field name="country" label="Country" autoComplete="country-name" />
          </div>

          <button
            type="submit"
            disabled={leaving}
            className="mt-8 w-full cursor-pointer rounded-xl bg-fg px-5 py-3
                       font-sans text-sm font-semibold text-surface outline-none
                       transition-opacity hover:opacity-90
                       focus-visible:ring-2 focus-visible:ring-accent/60
                       disabled:cursor-default disabled:opacity-60"
          >
            {leaving ? "Taking you to PayHere…" : "Continue to PayHere"}
          </button>

          {/* The terms and the refund policy belong at the moment of payment,
              not only in a footer three pages away. That is what the card
              networks ask for and what a payment provider's review checks —
              and it is also simply where somebody about to be charged wants to
              read "cancel any time". */}
          <p className="mt-4 text-center font-sans text-xs leading-relaxed text-muted">
            Card details are entered on PayHere and never reach OpenChapter. By
            continuing you agree to the{" "}
            <Link href="/terms" className="underline hover:text-fg">
              terms
            </Link>{" "}
            and the{" "}
            <Link href="/refunds" className="underline hover:text-fg">
              refund policy
            </Link>
            .
          </p>
        </form>
      </div>
    </main>
  );
}

/** One labelled input, in the shape the auth forms use. */
function Field({
  name,
  label,
  type = "text",
  autoComplete,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`checkout-${name}`}
        className="block font-sans text-xs font-medium text-muted"
      >
        {label}
      </label>
      <input
        id={`checkout-${name}`}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3
                   py-2.5 font-sans text-sm text-fg outline-none
                   placeholder:text-muted focus-visible:border-accent
                   focus-visible:ring-2 focus-visible:ring-accent/40"
      />
      {hint && <p className="mt-1 font-sans text-xs text-muted">{hint}</p>}
    </div>
  );
}
