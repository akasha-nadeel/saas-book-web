import { offerFor } from "@/app/collab/actions";
import { AcceptInvite } from "@/components/collab/accept-invite";

/**
 * The far end of a share link.
 *
 * **Gated rather than public**, and reached through the ordinary sign-in wall in
 * `src/proxy.ts` — which is what makes the link a pointer rather than a
 * credential. By the time anybody is here they are signed in, and
 * `acceptInvite` refuses them unless their *confirmed* address is the one the
 * invitation was addressed to. A forwarded link therefore grants nothing, which
 * is the property the whole invitation design rests on.
 *
 * The offer is resolved on the server because the token column is not granted to
 * `authenticated`: anybody who could read a token could accept an invitation
 * addressed to somebody else.
 *
 * `params` is a Promise and must be awaited — see AGENTS.md.
 */
export default async function InvitePage(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  const { token } = await props.params;
  const { via } = await props.searchParams;
  const offer = await offerFor(token);

  /*
   * **`via=link` means "signing in was the errand", and it only ever suppresses
   * a question — never a check.** It is set by `src/proxy.ts` when it turns an
   * invitation away for a session, and by the switch-account button on the card
   * itself. Anybody can of course put it in a URL by hand, and it costs nothing
   * if they do: `acceptInvite` still refuses everyone whose *confirmed* address
   * is not the invited one, so the worst a forged marker can do is accept an
   * invitation that was already addressed to the person pressing.
   */
  return (
    <AcceptInvite token={token} offer={offer} viaLink={via === "link"} />
  );
}
