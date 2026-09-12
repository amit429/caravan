"use client";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AppBar } from "@/components/caravan/app-bar";

export default function SignInPage() {
  const supabase = createBrowserSupabaseClient();

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto">
      <AppBar title="" />
      <div className="flex-1 flex flex-col justify-center gap-5 px-5">
        <h1 className="font-display text-2xl font-semibold">Sign in to start a trip</h1>
        <p className="text-ink-2 text-[15px]">
          Only you need an account. Everyone you invite joins with a name and an email, nothing
          else.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10">
        <button
          onClick={signInWithGoogle}
          className="w-full py-4 rounded-xl border border-line font-semibold flex items-center justify-center gap-2"
        >
          Continue with Google
        </button>
        <p className="text-xs text-ink-3 text-center">
          Joining someone else&rsquo;s trip? Just open the link they sent you.
        </p>
      </div>
    </main>
  );
}
