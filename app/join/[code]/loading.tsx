import { FlowShell } from "@/components/caravan/flow-shell";
import { Skeleton } from "@/components/caravan/skeleton";

export default function InviteLandingLoading() {
  return (
    <FlowShell className="justify-end gap-4 px-5 pb-10 pt-8 md:justify-center md:px-8">
      <div className="flex-1 md:hidden" />
      <Skeleton className="h-6 w-28 rounded-full" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/3" />
      <div className="flex-1 md:hidden" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </FlowShell>
  );
}
