import { Skeleton } from "@/components/caravan/skeleton";

export default function TripShellLoading() {
  return (
    <div className="h-dvh flex flex-col bg-paper md:flex-row">
      <div className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-line md:bg-card md:px-4 md:py-6">
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <Skeleton className="size-8 rounded-xl" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden md:max-w-2xl">
        <div className="flex items-center gap-1.5 border-b border-line bg-card px-3 py-3 md:hidden">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="flex-1" />
      </div>
    </div>
  );
}
