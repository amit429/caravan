import { TabBar } from "@/components/caravan/tab-bar";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto">
      <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
      <TabBar tripId={tripId} />
    </div>
  );
}
