export function Card({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "flat" | "line";
  className?: string;
}) {
  const variantClass = {
    default: "bg-card",
    flat: "bg-sunk",
    line: "bg-transparent border border-line",
  }[variant];
  return <div className={`rounded-lg p-4 ${variantClass} ${className}`}>{children}</div>;
}
