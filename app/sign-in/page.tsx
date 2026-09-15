import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { SignInContent } from "./sign-in-content";

export default async function SignInPage() {
  const admin = await getAuthUser();
  if (admin) redirect("/trips");

  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
