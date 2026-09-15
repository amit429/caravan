"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, MessageCircle, Map, User, Settings } from "lucide-react";

const TABS = [
  { name: "Room", href: (tripId: string) => `/trip/${tripId}/room`, icon: MessageCircle },
  { name: "Plan", href: (tripId: string) => `/trip/${tripId}/plan`, icon: Map },
  { name: "You", href: (tripId: string) => `/trip/${tripId}/you`, icon: User },
] as const;

export function SidebarNav({
  tripId,
  tripName,
  badges = {},
  isAdmin = false,
}: {
  tripId: string;
  tripName?: string;
  badges?: Partial<Record<string, number>>;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-line md:bg-card md:px-4 md:py-6">
      <Link
        href="/trips"
        className="group flex items-center gap-2.5 rounded-lg px-2 pb-3 pt-1 text-ink transition-colors hover:text-plum"
      >
        <div className="size-8 rounded-xl bg-plum grid place-items-center text-white font-semibold text-sm shrink-0">C</div>
        <span className="font-display text-base font-semibold truncate">{tripName ?? "Caravan"}</span>
      </Link>
      <Link
        href="/trips"
        className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink-3 transition-colors hover:bg-sunk hover:text-ink-2"
      >
        <ArrowLeft className="size-3.5" />
        All trips
      </Link>
      {TABS.map((tab) => {
        const href = tab.href(tripId);
        const active = pathname === href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.name}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-plum-t text-plum" : "text-ink-2 hover:bg-sunk"
            }`}
          >
            <Icon className="size-4" />
            {tab.name}
            {badges[tab.name] ? (
              <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-stop px-1 text-[10px] font-semibold text-white">
                {badges[tab.name]}
              </span>
            ) : null}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href={`/trip/${tripId}/settings`}
          className={`mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname === `/trip/${tripId}/settings` ? "bg-plum-t text-plum" : "text-ink-2 hover:bg-sunk"
          }`}
        >
          <Settings className="size-4" />
          Trip settings
        </Link>
      )}
    </nav>
  );
}
