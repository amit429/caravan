import { FlowShell } from "@/components/caravan/primitives/flow-shell";
import { Skeleton } from "@/components/caravan/primitives/skeleton";

export default function SignInLoading() {
  return (
    <FlowShell>
      <div className="px-5 pt-1 pb-3">
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <div className="flex-1 flex flex-col justify-center gap-5 px-5 md:px-8">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="flex flex-col gap-4 px-5 pb-10 md:px-8">
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </FlowShell>
  );
}
