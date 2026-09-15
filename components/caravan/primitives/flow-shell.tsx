export function FlowShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // dvh, not vh/screen: 100vh is the viewport height with the mobile browser's
    // address bar collapsed, which is taller than what's actually visible on
    // first paint — that phantom extra height is what makes a 2-line screen
    // scrollable. dvh tracks the real, currently-visible viewport instead.
    <div className="flex justify-center bg-paper md:min-h-dvh md:items-center md:bg-gradient-to-b md:from-plum-t md:to-paper md:py-12">
      <main
        className={`min-h-dvh w-full max-w-md md:min-h-0 md:max-w-lg md:rounded-3xl md:border md:border-line md:bg-card md:shadow-2xl md:shadow-plum/10 md:overflow-hidden flex flex-col ${className}`}
      >
        {children}
      </main>
    </div>
  );
}
