import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col justify-end gap-5 px-5 pb-10 pt-6 max-w-md mx-auto">
      <div className="flex-1" />
      <div className="flex items-center gap-2.5">
        <div className="size-11 rounded-2xl bg-plum grid place-items-center text-white font-semibold">C</div>
        <span className="font-display text-lg font-semibold">Caravan</span>
      </div>
      <h1 className="font-display text-3xl font-bold tracking-tight leading-tight">
        Somebody always ends up running the trip.
      </h1>
      <p className="text-ink-2 text-[15px] leading-relaxed">
        Share one link. Everyone drops their dates and budget from their own phone. An agent does
        the chasing, the date maths and the deciding.
      </p>
      <div className="flex-1" />
      <Link href="/sign-in" className="w-full py-4 rounded-xl bg-plum text-white text-center font-semibold">
        Start a trip
      </Link>
      <Link
        href="/join"
        className="w-full py-4 rounded-xl border border-line text-center font-semibold"
      >
        I have an invite code
      </Link>
    </main>
  );
}
