import { Skeleton } from "@/components/caravan/primitives/skeleton";

export default function CostLoading() {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden px-5 pb-8 pt-3 md:px-8">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}
