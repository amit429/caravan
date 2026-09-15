export function Chip({
  children,
  selected = false,
  onClick,
}: {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-sm border whitespace-nowrap transition-all duration-150 active:scale-95 ${
        selected ? "bg-ink border-ink text-paper font-medium scale-[1.04] shadow-sm" : "bg-card border-line text-ink-2 hover:border-ink-3"
      }`}
    >
      {children}
    </button>
  );
}
