import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DragSelection } from "../types";
import { buildSelectionBounds } from "../utils";

type UseScheduleSelectionProps = {
  enabled: boolean;
  onCommitRange: (
    dayIndex: number,
    startQuarter: number,
    endQuarter: number,
  ) => void;
};

export function useScheduleSelection({
  enabled,
  onCommitRange,
}: UseScheduleSelectionProps) {
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(
    null,
  );

  const isPointerDownRef = useRef(false);
  const pointerStartRef = useRef<{ dayIndex: number; quarter: number } | null>(
    null,
  );
  const dragSelectionRef = useRef<DragSelection | null>(null);
  const onCommitRangeRef = useRef(onCommitRange);

  useEffect(() => {
    onCommitRangeRef.current = onCommitRange;
  }, [onCommitRange]);

  useEffect(() => {
    dragSelectionRef.current = dragSelection;
  }, [dragSelection]);

  const clearSelection = useCallback(() => {
    isPointerDownRef.current = false;
    pointerStartRef.current = null;
    setDragSelection(null);
  }, []);

  const handleCellMouseDown = useCallback(
    (dayIndex: number, quarter: number, button: number) => {
      if (!enabled || button !== 0) return;
      isPointerDownRef.current = true;
      pointerStartRef.current = { dayIndex, quarter };
      setDragSelection(null);
    },
    [enabled],
  );

  const handleCellMouseEnter = useCallback(
    (dayIndex: number, quarter: number) => {
      if (!enabled || !isPointerDownRef.current) return;
      const pointerStart = pointerStartRef.current;
      if (!pointerStart || pointerStart.dayIndex !== dayIndex) return;
      if (pointerStart.quarter === quarter) return;

      setDragSelection((current) => {
        if (
          current &&
          current.dayIndex === dayIndex &&
          current.currentQuarter === quarter
        ) {
          return current;
        }

        return {
          dayIndex,
          startQuarter: pointerStart.quarter,
          currentQuarter: quarter,
        };
      });
    },
    [enabled],
  );

  const handleCellDoubleClick = useCallback(
    (dayIndex: number, quarter: number) => {
      if (!enabled) return;
      isPointerDownRef.current = false;
      pointerStartRef.current = null;
      setDragSelection(null);
      onCommitRangeRef.current(dayIndex, quarter, quarter + 4);
    },
    [enabled],
  );

  useEffect(() => {
    const handleMouseUp = () => {
      if (!isPointerDownRef.current) return;

      isPointerDownRef.current = false;
      pointerStartRef.current = null;

      const currentDrag = dragSelectionRef.current;
      if (!currentDrag) return;

      const { startQuarter, endQuarter } = buildSelectionBounds(currentDrag);
      onCommitRangeRef.current(currentDrag.dayIndex, startQuarter, endQuarter);
      setDragSelection(null);
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const activeSelection = useMemo(() => {
    if (!dragSelection) return null;
    const bounds = buildSelectionBounds(dragSelection);
    return {
      dayIndex: dragSelection.dayIndex,
      ...bounds,
    };
  }, [dragSelection]);

  return {
    activeSelection,
    clearSelection,
    onCellMouseDown: handleCellMouseDown,
    onCellMouseEnter: handleCellMouseEnter,
    onCellDoubleClick: handleCellDoubleClick,
  };
}
