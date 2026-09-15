import { Skeleton } from "@/components/caravan/skeleton";

export default function DestinationLoading() {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden px-5 pb-8 pt-3 md:px-8">
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
