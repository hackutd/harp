export type DragSelection = {
  dayIndex: number;
  startQuarter: number;
  currentQuarter: number;
};

export type ScheduleItem = {
  id: string;
  dayIndex: number;
  startQuarter: number;
  endQuarter: number;
  title: string;
  location: string;
  details: string;
  tags: string[];
};

export type SelectionRange = {
  dayIndex: number;
  startQuarter: number;
  endQuarter: number;
};

export type ScheduleComposerValues = {
  title: string;
  location: string;
  details: string;
  tag: string;
  isOtherTagSelected: boolean;
  otherTagValue: string;
};

export type ScheduleComposerMode = "create" | "edit";

export type ScheduleComposerSession = {
  sessionID: number;
  mode: ScheduleComposerMode;
  itemID: string | null;
  dayIndex: number;
  startQuarter: number;
  endQuarter: number;
  initialValues: ScheduleComposerValues;
};
