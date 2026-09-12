"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Room", href: (tripId: string) => `/trip/${tripId}/room` },
  { name: "Plan", href: (tripId: string) => `/trip/${tripId}/plan` },
  { name: "You", href: (tripId: string) => `/trip/${tripId}/you` },
] as const;

export function SidebarNav({
  tripId,
  badges = {},
}: {
  tripId: string;
  badges?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-line md:bg-card md:px-4 md:py-6">
      <div className="flex items-center gap-2.5 px-2 pb-6">
        <div className="size-8 rounded-xl bg-plum grid place-items-center text-white font-semibold text-sm">C</div>
        <span className="font-display text-base font-semibold">Caravan</span>
      </div>
      {TABS.map((tab) => {
        const href = tab.href(tripId);
        const active = pathname === href;
        return (
          <Link
            key={tab.name}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
              active ? "bg-plum-t text-plum" : "text-ink-2 hover:bg-sunk"
            }`}
          >
            <span className={`size-2 rounded-full ${active ? "bg-plum" : "bg-ink-3/50"}`} />
            {tab.name}
            {badges[tab.name] ? (
              <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-stop px-1 text-[10px] font-semibold text-white">
                {badges[tab.name]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
