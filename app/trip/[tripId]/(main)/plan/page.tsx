import { MapRouteIllustration } from "@/components/caravan/illustrations";

export default function PlanPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <MapRouteIllustration className="text-agent" />
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold">Nothing to plan yet</h2>
        <p className="text-sm text-ink-2 max-w-[280px]">
          Once the group starts talking, dates, budget, and destination will show up here.
        </p>
      </div>
    </div>
  );
}
