"use client";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AppBar } from "@/components/caravan/layout/app-bar";
import { FlowShell } from "@/components/caravan/primitives/flow-shell";
import { GoogleIcon } from "@/components/caravan/primitives/google-icon";

export function SignInContent() {
  const supabase = createBrowserSupabaseClient();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      // Must match the origin the user is actually on — the PKCE code verifier
      // cookie is scoped to that origin, and this project has more than one
      // valid Vercel domain. A hardcoded env var here breaks sign-in on any
      // domain other than the one it names.
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <FlowShell>
      <AppBar title="" />
      <div className="flex-1 flex flex-col justify-center gap-5 px-5 md:px-8">
        <h1 className="font-display text-2xl font-semibold">Sign in to start a trip</h1>
        <p className="text-ink-2 text-[15px]">
          Everyone in the group signs in with Google — it&rsquo;s how we confirm real emails and how you find your
          trips again from any device.
        </p>
        {error && (
          <p className="text-sm text-stop bg-stop-t rounded-md p-3">
            Couldn&rsquo;t sign you in: {error}. Please try again.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10 md:px-8">
        <button
          onClick={signInWithGoogle}
          className="w-full py-4 rounded-xl border border-line font-semibold flex items-center justify-center gap-2.5"
        >
          <GoogleIcon />
          Continue with Google
        </button>
        <p className="text-xs text-ink-3 text-center">
          Joining someone else&rsquo;s trip? Just open the link they sent you — you&rsquo;ll sign in from there.
        </p>
      </div>
    </FlowShell>
  );
}
