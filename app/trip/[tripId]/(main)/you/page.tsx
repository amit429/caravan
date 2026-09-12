import { ThreadIllustration } from "@/components/caravan/illustrations";

export default function YouPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <ThreadIllustration className="text-plum" />
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-lg font-semibold">Nothing needs you yet</h2>
        <p className="text-sm text-ink-2 max-w-[280px]">
          Your tasks and threads will show up here once the trip is moving.
        </p>
      </div>
    </div>
  );
}
