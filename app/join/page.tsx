"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlowShell } from "@/components/caravan/flow-shell";

export default function JoinEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <FlowShell className="justify-center gap-4 px-5 md:px-8">
      <h1 className="font-display text-2xl font-semibold">Enter your invite code</h1>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABCDEF"
        className="bg-card border border-line rounded-md p-3.5 font-mono tracking-widest text-center"
      />
      <button
        disabled={code.length < 6}
        onClick={() => router.push(`/join/${code}`)}
        className="w-full py-4 rounded-xl bg-plum text-white font-semibold disabled:opacity-40"
      >
        Continue
      </button>
    </FlowShell>
  );
}
