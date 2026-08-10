import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Sign in · OpenChapter",
};

export default async function SignInPage(props: PageProps<"/signin">) {
  const params = await props.searchParams;
  const next = safeNext(params.next);
  const email = typeof params.email === "string" ? params.email : undefined;

  /*
   * **Read off `next` rather than a flag of its own**, so the copy cannot
   * disagree with where the writer is actually going. Somebody arriving from an
   * invitation is the one visitor the standing words are wrong for, twice:
   * "Welcome back" greets a returning writer, and an invitee may have no account
   * at all, while "reach your shelf" names the one place they are not headed.
   * Their browser will also autofill the account being signed out of — the very
   * one that cannot accept — which is why the address is put in the field and
   * named in the sentence rather than merely implied.
   *
   * The words stop short of asserting the invitation is real: this arrives in a
   * query string and nothing here has checked it. `acceptInvite` is what
   * verifies, and it refuses anyone whose confirmed address is not the invited
   * one — so the worst a forged `?next=` can do is print a hopeful sentence.
   */
  const invited = next.startsWith("/invite/");

  return (
    <AuthForm
      mode="signin"
      next={next}
      email={email}
      heading={invited ? "Sign in to continue" : undefined}
      lede={
        invited
          ? email
            ? `Sign in as ${email} to accept the invitation.`
            : "Sign in as the invited address to accept the invitation."
          : undefined
      }
      problem={typeof params.error === "string" ? params.error : undefined}
    />
  );
}
