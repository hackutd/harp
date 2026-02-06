import { Check } from "lucide-react";

import { cn } from "@/shared/lib/utils";

interface Step {
  id: string;
  title: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="w-full">
      {/* Mobile view - compact */}
      <div className="flex md:hidden items-center justify-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-sm font-medium">{steps[currentStep]?.title}</span>
      </div>

      {/* Desktop view - full progress bar */}
      <div className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isClickable = onStepClick && index <= currentStep;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(index)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  isCompleted &&
                    "bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90",
                  isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                  isClickable && "cursor-pointer"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-2 transition-colors",
                    index < currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step titles below (desktop) */}
      <div className="hidden md:flex justify-between mt-2">
        {steps.map((step, index) => (
          <div
            key={`title-${step.id}`}
            className={cn(
              "text-xs text-center flex-1 last:flex-none",
              index === currentStep
                ? "text-primary font-medium"
                : "text-muted-foreground"
            )}
            style={{ maxWidth: index === steps.length - 1 ? "auto" : undefined }}
          >
            {step.title}
          </div>
        ))}
      </div>
    </div>
  );
}
