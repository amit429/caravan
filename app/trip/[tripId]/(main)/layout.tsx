import { TabBar } from "@/components/caravan/tab-bar";
import { SidebarNav } from "@/components/caravan/sidebar-nav";

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-paper md:flex-row">
      <SidebarNav tripId={tripId} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col overflow-hidden md:max-w-2xl">
        <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
        <TabBar tripId={tripId} />
      </div>
    </div>
  );
}
