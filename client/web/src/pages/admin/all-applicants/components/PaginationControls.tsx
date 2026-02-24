import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  prevCursor: string | null;
  nextCursor: string | null;
  loading: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function PaginationControls({
  prevCursor,
  nextCursor,
  loading,
  onPrevPage,
  onNextPage,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevPage}
        disabled={!prevCursor || loading}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextPage}
        disabled={!nextCursor || loading}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
