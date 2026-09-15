import { FlowShell } from "@/components/caravan/primitives/flow-shell";
import { Skeleton } from "@/components/caravan/primitives/skeleton";

export default function LandingLoading() {
  return (
    <FlowShell className="justify-end gap-5 px-5 pb-10 pt-6 md:justify-center md:px-8">
      <div className="flex-1 md:hidden" />
      <div className="flex items-center gap-2.5">
        <Skeleton className="size-11 rounded-2xl" />
        <Skeleton className="h-5 w-24" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex-1 md:hidden" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </FlowShell>
  );
}
