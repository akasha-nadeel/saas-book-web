import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNext } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Create an account · OpenChapter",
};

export default async function SignUpPage(props: PageProps<"/signup">) {
  const params = await props.searchParams;

  return <AuthForm mode="signup" next={safeNext(params.next)} />;
}
