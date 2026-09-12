"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Avatar } from "@/components/caravan/avatar";

export function AccountMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function logOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Account menu">
        <Avatar name={email.split("@")[0]} size="md" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-line bg-card p-2 shadow-xl">
            <div className="px-3 py-2">
              <div className="text-xs text-ink-3">Signed in as</div>
              <div className="text-sm font-medium truncate">{email}</div>
            </div>
            <div className="my-1 h-px bg-line" />
            <button
              onClick={logOut}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-stop hover:bg-stop-t"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
