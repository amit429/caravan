import { Skeleton } from "@/components/caravan/primitives/skeleton";

function SectionSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <section className="flex flex-col gap-2">
      <Skeleton className="h-3 w-16" />
      <div className="flex flex-col gap-2 rounded-lg bg-card p-3.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${85 - i * 15}%` }} />
        ))}
      </div>
    </section>
  );
}

export default function PlanLoading() {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden px-5 pb-8 pt-5 md:px-8">
      <SectionSkeleton lines={3} />
      <SectionSkeleton lines={2} />
      <SectionSkeleton lines={1} />
      <SectionSkeleton lines={2} />
    </div>
  );
}
