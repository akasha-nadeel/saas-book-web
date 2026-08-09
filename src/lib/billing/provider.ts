/**
 * Which gateway this deployment sells through.
 *
 * There are two, and there will not be three. PayHere came first and is
 * verified against its sandbox end to end; Paddle arrived because PayHere
 * cannot sell a subscription to an unregistered business and Paddle can. Both
 * are optional in the way everything here is optional — with neither
 * configured there are no plans **and nothing is held back**, which is what
 * keeps a self-hosted copy on its owner's own API keys working exactly as it
 * did before billing existed.
 *
 * **One is active at a time, and Paddle wins if both are set.** Two live
 * gateways would mean two ways to be on Pro, two webhooks writing one
 * `subscriptions` row and two answers to "cancel this". The row records which
 * provider wrote it, so a switch later leaves the writers already paying
 * exactly where they are: their row keeps saying `payhere`, their cancel
 * button keeps calling PayHere, and only new checkouts go the new way.
 */

import { isPaddleConfigured } from "./paddle";
import { isBillingConfigured as isPayHereConfigured } from "./payhere";

export type Provider = "paddle" | "payhere";

/** Which gateway a *new* checkout goes through, or null if none can. */
export function activeProvider(): Provider | null {
  if (isPaddleConfigured()) return "paddle";
  if (isPayHereConfigured()) return "payhere";
  return null;
}

/**
 * Whether anything is for sale at all.
 *
 * What `requirePro()` and the subscription route ask before gating anything:
 * no gateway means no plans, and no plans must never mean a locked feature.
 */
export function billingConfigured(): boolean {
  return activeProvider() !== null;
}

/** Narrows whatever a database row says the provider was. */
export function asProvider(value: unknown): Provider {
  return value === "paddle" ? "paddle" : "payhere";
}
