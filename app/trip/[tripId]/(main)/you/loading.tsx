import { Skeleton } from "@/components/caravan/skeleton";

export default function YouLoading() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-col gap-2 px-4 pt-3">
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
      <div className="flex-1 px-4 pt-4 flex flex-col gap-3">
        <Skeleton className="h-16 w-64 rounded-r-2xl rounded-bl-2xl" />
      </div>
      <div className="border-t border-line bg-card px-3.5 py-2.5 pb-5">
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </div>
  );
}
