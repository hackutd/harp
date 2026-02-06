import { ChevronLeft, ChevronRight, Save, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

interface StepNavigationProps {
  currentStep: number;
  onPrevious: () => void;
  onNext: () => void;
  onSave: () => void;
  onSubmit?: () => void;
  isSaving: boolean;
  isSubmitting: boolean;
  isLastStep: boolean;
}

export function StepNavigation({
  currentStep,
  onPrevious,
  onNext,
  onSave,
  onSubmit,
  isSaving,
  isSubmitting,
  isLastStep,
}: StepNavigationProps) {
  const isFirstStep = currentStep === 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t">
      {/* Save button */}
      <Button
        type="button"
        variant="outline"
        onClick={onSave}
        disabled={isSaving || isSubmitting}
      >
        <Save className="w-4 h-4 mr-2" />
        {isSaving ? "Saving..." : "Save Progress"}
      </Button>

      {/* Navigation buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          disabled={isFirstStep || isSaving || isSubmitting}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSaving || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Application"}
            <Send className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={isSaving || isSubmitting}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
