"use client";
import { useCallback, useRef, useState } from "react";
import { BottomSheet } from "@/components/caravan/primitives/bottom-sheet";

type ConfirmState = { title: string; body?: string; destructive?: boolean };

// In-app confirm sheet instead of the browser's native window.confirm() —
// matches the rest of the app's styling and doesn't block the JS thread.
// Usage: const { confirm, dialog } = useConfirm(); ... if (!(await confirm("Delete this?"))) return; ... return <>{dialog}...</>
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((title: string, body?: string, opts?: { destructive?: boolean }) => {
    setState({ title, body, destructive: opts?.destructive });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function respond(value: boolean) {
    setState(null);
    resolver.current?.(value);
    resolver.current = null;
  }

  const dialog = (
    <BottomSheet open={!!state} onClose={() => respond(false)}>
      {state && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold">{state.title}</h2>
          {state.body && <p className="text-sm text-ink-2">{state.body}</p>}
          <div className="flex gap-2.5 pt-1">
            <button onClick={() => respond(false)} className="flex-1 rounded-xl border border-line py-3.5 font-semibold">
              Cancel
            </button>
            <button
              onClick={() => respond(true)}
              className={`flex-1 rounded-xl py-3.5 font-semibold text-white ${state.destructive ? "bg-stop" : "bg-plum"}`}
            >
              {state.destructive ? "Delete" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );

  return { confirm, dialog };
}
