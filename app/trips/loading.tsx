import { Skeleton } from "@/components/caravan/skeleton";

export default function TripsLoading() {
  return (
    <main className="min-h-dvh flex flex-col mx-auto w-full max-w-md md:max-w-2xl px-5 pt-6 pb-10 gap-3 md:px-8">
      <div className="flex items-center mb-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="ml-auto size-8 rounded-full" />
      </div>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="ml-auto h-5 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
