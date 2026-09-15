import { Skeleton } from "@/components/caravan/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden px-5 pb-8 pt-5 md:px-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
