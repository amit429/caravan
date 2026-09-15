"use client";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GoogleIcon } from "@/components/caravan/google-icon";

export function JoinWithGoogleButton({ code, label = "Continue with Google" }: { code: string; label?: string }) {
  const supabase = createBrowserSupabaseClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      // Same origin-matching requirement as admin sign-in (the PKCE code
      // verifier cookie is scoped to the origin the flow started on), plus
      // `next` so the callback knows to finish this join instead of landing
      // on the generic /trips destination.
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/join/${code}/complete`)}` },
    });
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="w-full py-4 rounded-xl bg-plum text-white font-semibold flex items-center justify-center gap-2.5"
    >
      <span className="grid size-5 place-items-center rounded-full bg-white">
        <GoogleIcon className="size-3.5" />
      </span>
      {label}
    </button>
  );
}
