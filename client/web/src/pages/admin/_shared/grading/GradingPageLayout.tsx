import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface GradingPageLayoutProps {
  backUrl: string;
  loading: boolean;
  headerContent: ReactNode;
  currentIndex: number;
  totalCount: number;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  detailsPanel: ReactNode;
  actionPanel: ReactNode;
  emptyState: ReactNode;
}

export function GradingPageLayout({
  backUrl,
  loading,
  headerContent,
  currentIndex,
  totalCount,
  onNavigateNext,
  onNavigatePrev,
  canNavigatePrev,
  canNavigateNext,
  detailsPanel,
  actionPanel,
  emptyState,
}: GradingPageLayoutProps) {
  const navigate = useNavigate();

  if (!loading && totalCount === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="-m-4 flex flex-col h-[calc(100%+2rem)] min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 bg-gray-50 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer"
          onClick={() => navigate(backUrl)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {loading ? <Skeleton className="h-5 w-40" /> : headerContent}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={onNavigatePrev}
            disabled={!canNavigatePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {totalCount > 0 ? `${currentIndex + 1} of ${totalCount}` : "-"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            onClick={onNavigateNext}
            disabled={!canNavigateNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel - Application details (75%) */}
        <div className="w-3/4 overflow-auto border-r">{detailsPanel}</div>

        {/* Right panel (25%) */}
        <div className="w-1/4 flex flex-col bg-gray-50/50">
          <div className="flex-1 overflow-auto">{actionPanel}</div>
          {/* Navigation hint */}
          <div className="shrink-0 border-t bg-gray-50 p-4 pt-2">
            <p className="text-xs text-muted-foreground text-center mt-2">
              Use{" "}
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                ←
              </kbd>{" "}
              <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
                →
              </kbd>{" "}
              arrow keys to navigate &middot; Esc to go back
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
