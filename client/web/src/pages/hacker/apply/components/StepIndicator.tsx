import { ChevronLeft } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
}

export function StepIndicator({
  currentStep,
  totalSteps,
  onBack,
}: StepIndicatorProps) {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="-ml-2 flex size-9 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0]"
      >
        <ChevronLeft className="size-5" strokeWidth={1.75} />
      </button>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#EDEDED]">
        <div
          className="h-full rounded-full bg-black transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs font-light tabular-nums text-[#8A8A8A]">
        {currentStep + 1}/{totalSteps}
      </span>
    </div>
  );
}
