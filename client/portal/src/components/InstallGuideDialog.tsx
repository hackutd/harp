import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/shared/lib/utils";

interface GuideStep {
  src: string;
  caption: string;
}

const IOS_STEPS: GuideStep[] = [
  {
    src: "/install-guide/ios-step-1.png",
    caption: "Tap the \u2022\u2022\u2022 button next to the address bar",
  },
  {
    src: "/install-guide/ios-step-2.png",
    caption: 'Tap "Share"',
  },
  {
    src: "/install-guide/ios-step-3.png",
    caption: 'Tap "View More"',
  },
  {
    src: "/install-guide/ios-step-4.png",
    caption: 'Tap "Add to Home Screen"',
  },
  {
    src: "/install-guide/ios-step-5.png",
    caption: 'Tap "Add" and the app will appear on your home screen',
  },
];

export interface InstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InstallGuideDialog({
  open,
  onOpenChange,
}: InstallGuideDialogProps) {
  const [step, setStep] = useState(0);

  const handleOpenChange = (next: boolean) => {
    if (!next) setStep(0);
    onOpenChange(next);
  };

  const isLast = step === IOS_STEPS.length - 1;
  const current = IOS_STEPS[step];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm rounded-xl p-5 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-normal">Add to Home Screen</DialogTitle>
          <DialogDescription className="min-h-10">
            {current.caption}
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-[min(45vh,24rem)] items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E5]">
          <img
            src={current.src}
            alt={current.caption}
            className="max-h-full max-w-full object-contain"
          />
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {IOS_STEPS.map((s, i) => (
            <span
              key={s.src}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === step ? "bg-black" : "bg-[#E5E5E5]",
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Back
          </Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => {
              if (isLast) {
                handleOpenChange(false);
              } else {
                setStep((s) => Math.min(IOS_STEPS.length - 1, s + 1));
              }
            }}
          >
            {isLast ? "Done" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
