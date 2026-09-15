"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Map, User } from "lucide-react";

const TABS = [
  { name: "Room", href: (tripId: string) => `/trip/${tripId}/room`, icon: MessageCircle },
  { name: "Plan", href: (tripId: string) => `/trip/${tripId}/plan`, icon: Map },
  { name: "You", href: (tripId: string) => `/trip/${tripId}/you`, icon: User },
] as const;

export function TabBar({ tripId, badges = {} }: { tripId: string; badges?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <div className="flex border-t border-line bg-card pt-2 px-2 pb-6 md:hidden">
      {TABS.map((tab) => {
        const href = tab.href(tripId);
        const active = pathname === href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.name}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-1 text-[11px] relative transition-colors ${
              active ? "text-plum font-semibold" : "text-ink-3"
            }`}
          >
            <Icon className={`size-5 transition-transform ${active ? "scale-110" : ""}`} strokeWidth={active ? 2.5 : 2} />
            {tab.name}
            {badges[tab.name] ? (
              <span className="absolute -top-0.5 right-1/2 mr-[-19px] bg-stop text-white text-[9px] font-semibold min-w-[15px] h-[15px] rounded-full grid place-items-center px-1">
                {badges[tab.name]}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
