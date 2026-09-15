import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function SummaryLinkCard({
  href,
  label,
  title,
  subtitle,
}: {
  href: string;
  label: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-mono text-xs text-ink-3">{label}</h3>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg bg-card p-3.5 transition-colors hover:bg-sunk"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-xs text-ink-3">{subtitle}</div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-ink-3" />
      </Link>
    </section>
  );
}
