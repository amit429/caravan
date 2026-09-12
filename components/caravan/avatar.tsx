const MEMBER_COLORS = ["m1", "m2", "m3", "m4", "m5", "m6"] as const;

export function memberColorClass(index: number) {
  return `bg-${MEMBER_COLORS[index % MEMBER_COLORS.length]}`;
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
