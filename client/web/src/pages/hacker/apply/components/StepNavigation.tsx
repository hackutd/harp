import { ChevronLeft, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface StepNavigationProps {
  currentStep: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  isSaving: boolean;
  isSubmitting: boolean;
  isResumeBusy?: boolean;
  isLastStep: boolean;
}

export function StepNavigation({
  currentStep,
  onPrevious,
  onNext,
  onSubmit,
  isSaving,
  isSubmitting,
  isResumeBusy = false,
  isLastStep,
}: StepNavigationProps) {
  const isFirstStep = currentStep === 0;
  const busy = isSaving || isSubmitting || isResumeBusy;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#F0F0F0] bg-white/95 px-5 pt-3 backdrop-blur-sm md:left-(--sidebar-width)"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex w-full max-w-md items-center gap-3 md:max-w-5xl">
        {!isFirstStep && (
          <button
            type="button"
            onClick={onPrevious}
            disabled={busy}
            aria-label="Previous step"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border border-[#D9D9D9] text-black transition-colors hover:bg-[#F5F5F5] disabled:opacity-50"
          >
            <ChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
        )}

        {isLastStep ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                disabled={busy}
                className="h-12 flex-1 rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isSubmitting ? "Submitting..." : "Submit application"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Submit your application?</AlertDialogTitle>
                <AlertDialogDescription>
                  Once submitted, you won&apos;t be able to make any further
                  edits to your application. Please double-check your answers
                  before continuing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="rounded-full bg-black text-white hover:bg-black/85"
                >
                  Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={busy}
            className="h-12 flex-1 rounded-full bg-black text-sm font-normal text-white hover:bg-black/85"
          >
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
