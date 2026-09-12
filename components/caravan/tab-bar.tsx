"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Room", href: (tripId: string) => `/trip/${tripId}/room` },
  { name: "Plan", href: (tripId: string) => `/trip/${tripId}/plan` },
  { name: "You", href: (tripId: string) => `/trip/${tripId}/you` },
] as const;

export function TabBar({ tripId, badges = {} }: { tripId: string; badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <div className="flex border-t border-line bg-card pt-2 px-2 pb-6">
      {TABS.map((tab) => {
        const href = tab.href(tripId);
        const active = pathname === href;
        return (
          <Link
            key={tab.name}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 text-[11px] relative ${
              active ? "text-plum font-semibold" : "text-ink-3"
            }`}
          >
            <span className={`size-5 rounded-md ${active ? "bg-plum" : "bg-ink-3/50"}`} />
            {tab.name}
            {badges[tab.name] ? (
              <span className="absolute -top-1 right-1/2 mr-[-19px] bg-stop text-white text-[9px] font-semibold min-w-[15px] h-[15px] rounded-full grid place-items-center px-1">
                {badges[tab.name]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
