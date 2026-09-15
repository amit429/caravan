import { Skeleton } from "@/components/caravan/skeleton";

export default function RoomLoading() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 px-4 pt-4 pb-3 flex flex-col gap-3.5">
        <div className="flex gap-2">
          <Skeleton className="size-6 rounded-full shrink-0" />
          <Skeleton className="h-12 w-48 rounded-[4px_15px_15px_15px]" />
        </div>
        <Skeleton className="ml-auto h-9 w-40 rounded-[15px_4px_15px_15px]" />
        <div className="flex gap-2">
          <Skeleton className="size-6 rounded-full shrink-0" />
          <Skeleton className="h-16 w-56 rounded-[4px_15px_15px_15px]" />
        </div>
      </div>
      <div className="border-t border-line bg-card px-3.5 py-2.5 pb-5">
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </div>
  );
}
