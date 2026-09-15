export function EmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-lg bg-sunk text-center ${compact ? "px-5 py-6" : "flex-1 justify-center px-8 py-10"}`}
    >
      <div className="text-ink-3">{icon}</div>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        <p className="max-w-[260px] text-sm text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  );
}
