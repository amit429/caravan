export function FlowShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex justify-center bg-paper md:min-h-screen md:items-center md:bg-gradient-to-b md:from-plum-t md:to-paper md:py-12">
      <main
        className={`min-h-screen w-full max-w-md md:min-h-0 md:max-w-lg md:rounded-3xl md:border md:border-line md:bg-card md:shadow-2xl md:shadow-plum/10 md:overflow-hidden flex flex-col ${className}`}
      >
        {children}
      </main>
    </div>
  );
}
