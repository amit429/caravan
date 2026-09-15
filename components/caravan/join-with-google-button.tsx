"use client";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GoogleIcon } from "@/components/caravan/google-icon";
import { POST_AUTH_REDIRECT_COOKIE } from "@/lib/auth/post-auth-redirect";

export function JoinWithGoogleButton({ code, label = "Continue with Google" }: { code: string; label?: string }) {
  const supabase = createBrowserSupabaseClient();

  async function signInWithGoogle() {
    // Where to land after OAuth travels through the callback as a short-lived
    // cookie, not a `next` query param on redirectTo — Supabase validates
    // redirectTo against an allow-list of exact URLs, and a query string that
    // isn't part of the registered entry can get silently stripped or
    // rejected. This keeps redirectTo identical to admin sign-in's (already
    // known-good) plain /auth/callback for every flow.
    document.cookie = `${POST_AUTH_REDIRECT_COOKIE}=${encodeURIComponent(`/join/${code}/complete`)}; path=/; max-age=600; SameSite=Lax`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
