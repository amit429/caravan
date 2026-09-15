// Full literal class names, not built from a template string: Tailwind's build-time
// scanner only picks up complete class tokens that appear as text in source files, so
// `` `bg-${color}` `` never generates the CSS rule — it silently renders with no
// background at all.
const MEMBER_COLOR_CLASSES = ["bg-m1", "bg-m2", "bg-m3", "bg-m4", "bg-m5", "bg-m6"] as const;

export function memberColorClass(index: number) {
  return MEMBER_COLOR_CLASSES[index % MEMBER_COLOR_CLASSES.length];
}

export function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

export function Avatar({
  name,
  colorIndex = 0,
  size = "md",
}: {
  name: string;
  colorIndex?: number;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeClass = { xs: "size-5 text-[9px]", sm: "size-6 text-[9.5px]", md: "size-8 text-xs", lg: "size-11 text-base" }[size];
  return (
    <div
      className={`${sizeClass} ${memberColorClass(colorIndex)} shrink-0 rounded-full grid place-items-center font-semibold text-white`}
    >
      {initials(name)}
    </div>
  );
}

export function AvatarStack({ members }: { members: { name: string; colorIndex: number }[] }) {
  return (
    <div className="flex">
      {members.map((m, i) => (
        <div key={m.name + i} className={i > 0 ? "-ml-2" : ""}>
          <div className="ring-2 ring-paper rounded-full">
            <Avatar name={m.name} colorIndex={m.colorIndex} size="sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
