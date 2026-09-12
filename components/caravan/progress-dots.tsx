export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={`h-1.5 rounded-full ${i === step ? "w-5.5 bg-plum" : "w-1.5 bg-line"}`}
        />
      ))}
    </div>
  );
}
