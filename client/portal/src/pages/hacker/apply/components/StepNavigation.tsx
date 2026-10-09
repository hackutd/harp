import { IconChevronLeft } from "@tabler/icons-react";

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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-canvas/95 px-5 pt-3 backdrop-blur-sm md:left-(--sidebar-width)"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex w-full max-w-md items-center gap-3 md:max-w-5xl">
        {!isFirstStep && (
          <button
            type="button"
            onClick={onPrevious}
            disabled={busy}
            aria-label="Previous step"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
          >
            <IconChevronLeft className="size-5" strokeWidth={1.75} />
          </button>
        )}

        {isLastStep ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                disabled={busy}
                loading={isSubmitting}
                className="h-12 flex-1 rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover"
              >
                {isSubmitting ? "Submitting..." : "Submit application"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Submit your application?</AlertDialogTitle>
                <AlertDialogDescription>
                  Submitting is{" "}
                  <strong className="font-medium text-foreground">final</strong>
                  . You{" "}
                  <strong className="font-medium text-foreground">
                    cannot edit
                  </strong>{" "}
                  your application afterwards, so double check your answers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={onSubmit}
                  disabled={isSubmitting}
                  className="rounded-full bg-tide text-white hover:bg-tide-hover"
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
            loading={isSaving}
            className="h-12 flex-1 rounded-full bg-tide text-sm font-normal text-white hover:bg-tide-hover"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
