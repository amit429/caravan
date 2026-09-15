import { Skeleton } from "@/components/caravan/skeleton";

export default function DecisionDetailLoading() {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden px-5 pb-8 pt-3 md:px-8">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
