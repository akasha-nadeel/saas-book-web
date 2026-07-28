import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Sign in · OpenChapter",
};

export default async function SignInPage(props: PageProps<"/signin">) {
  const params = await props.searchParams;

  return (
    <AuthForm
      mode="signin"
      next={safeNext(params.next)}
      problem={typeof params.error === "string" ? params.error : undefined}
    />
  );
}
