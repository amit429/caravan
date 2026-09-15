export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i === step ? "w-6 bg-plum" : i < step ? "w-1.5 bg-plum/40" : "w-1.5 bg-line"
          }`}
        />
      ))}
    </div>
  );
}
