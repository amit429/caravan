"use client";
import { useRouter } from "next/navigation";

export function AppBar({
  title,
  back = true,
  right,
}: {
  title: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3 px-5 pt-1 pb-3">
      {back && (
        <button onClick={() => router.back()} className="text-xl -mt-0.5" aria-label="Back">
          &lsaquo;
        </button>
      )}
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {right && <span className="ml-auto text-xs text-ink-2">{right}</span>}
    </div>
  );
}
