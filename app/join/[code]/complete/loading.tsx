import { FlowShell } from "@/components/caravan/primitives/flow-shell";
import { Skeleton } from "@/components/caravan/primitives/skeleton";

export default function JoinCompleteLoading() {
  return (
    <FlowShell className="justify-center items-center gap-4 px-8 text-center">
      <Skeleton className="size-11 rounded-full" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full max-w-[260px]" />
    </FlowShell>
  );
}
