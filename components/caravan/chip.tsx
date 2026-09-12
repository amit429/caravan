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
      className={`px-3.5 py-2 rounded-full text-sm border whitespace-nowrap ${
        selected ? "bg-ink border-ink text-paper font-medium" : "bg-card border-line text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}
