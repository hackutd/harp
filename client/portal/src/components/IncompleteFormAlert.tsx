import { AlertCircle } from "lucide-react";

import { type IncompleteSection, joinNames } from "@/shared/lib/form-errors";
import { cn } from "@/shared/lib/utils";

interface IncompleteFormAlertProps {
  sections: IncompleteSection[];
  /**
   * When provided, each section gets a button that jumps to it — used by the
   * multi-step application wizard, where the gap is on another step entirely.
   */
  onJumpToSection?: (sectionId: string) => void;
  className?: string;
}

/**
 * Failed-submit summary that names the sections and questions still missing an
 * answer, so the hacker knows where to go instead of being told to "complete
 * all required fields".
 */
export function IncompleteFormAlert({
  sections,
  onJumpToSection,
  className,
}: IncompleteFormAlertProps) {
  if (sections.length === 0) return null;

  const title =
    sections.length === 1
      ? `${sections[0].label} is incomplete`
      : `${joinNames(sections.map((s) => s.label))} are incomplete`;

  // With a single section the heading already names it; repeating it above the
  // questions would just be noise.
  const showSectionHeadings = sections.length > 1 || !!onJumpToSection;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5",
        className,
      )}
    >
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-destructive"
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-normal text-destructive">{title}</p>
          <p className="text-xs font-light text-[#8A8A8A]">
            Answer the questions below, then submit again.
          </p>
        </div>

        <ul className="space-y-3">
          {sections.map((section) => (
            <li key={section.id} className="space-y-1.5">
              {showSectionHeadings && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] font-light tracking-widest text-[#8A8A8A] uppercase">
                    {section.label}
                  </span>
                  {onJumpToSection && (
                    <button
                      type="button"
                      onClick={() => onJumpToSection(section.id)}
                      className="shrink-0 text-xs font-light text-black underline underline-offset-2 transition-colors hover:text-[#8A8A8A]"
                    >
                      Go to section
                    </button>
                  )}
                </div>
              )}
              <ul className="space-y-1">
                {section.fieldLabels.map((label) => (
                  <li
                    key={label}
                    className="flex gap-2 text-sm font-light text-black"
                  >
                    <span aria-hidden className="text-[#B8B8B8]">
                      &bull;
                    </span>
                    <span className="min-w-0">{label}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
