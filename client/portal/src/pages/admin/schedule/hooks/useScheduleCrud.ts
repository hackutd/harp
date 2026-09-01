import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react";
import { toast } from "sonner";

import { errorAlert } from "@/shared/lib/api";

import {
  createScheduleItem,
  deleteScheduleItem,
  updateScheduleItem,
} from "../api";
import { mapScheduleItemsToGrid } from "../mappers/mapScheduleItemsToGrid";
import type {
  ScheduleComposerSession,
  ScheduleComposerValues,
  ScheduleItem,
} from "../types";
import { dateForQuarter } from "../utils";

type UseScheduleCrudProps = {
  scheduleDays: Date[];
  setScheduleItems: Dispatch<SetStateAction<ScheduleItem[]>>;
};

function getTagValue(values: ScheduleComposerValues) {
  if (!values.isOtherTagSelected) {
    return values.tag.trim();
  }
  return values.otherTagValue.trim();
}

export function useScheduleCrud({
  scheduleDays,
  setScheduleItems,
}: UseScheduleCrudProps) {
  const [creatingItem, setCreatingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);

  const saveScheduleItem = useCallback(
    async (
      session: ScheduleComposerSession,
      values: ScheduleComposerValues,
    ) => {
      const day = scheduleDays[session.dayIndex];
      if (!day) {
        return false;
      }

      const tagValue = getTagValue(values);
      const payload = {
        event_name: values.title.trim(),
        description: values.details.trim(),
        start_time: dateForQuarter(day, session.startQuarter).toISOString(),
        end_time: dateForQuarter(day, session.endQuarter).toISOString(),
        location: values.location.trim(),
        tags: tagValue ? [tagValue] : [],
      };

      setCreatingItem(true);
      const response =
        session.mode === "edit" && session.itemID
          ? await updateScheduleItem(session.itemID, payload)
          : await createScheduleItem(payload);
      setCreatingItem(false);

      const expectedStatus = session.mode === "edit" ? 200 : 201;
      if (response.status !== expectedStatus || !response.data?.schedule) {
        errorAlert(response);
        return false;
      }

      const mappedItem = mapScheduleItemsToGrid(
        [response.data.schedule],
        scheduleDays,
      )[0];
      if (!mappedItem) {
        toast.error(
          "Schedule item saved, but it is outside the current date range.",
        );
        return true;
      }

      if (session.mode === "edit" && session.itemID) {
        setScheduleItems((current) => {
          let replaced = false;
          const nextItems = current.map((item) => {
            if (item.id === session.itemID) {
              replaced = true;
              return mappedItem;
            }
            return item;
          });

          if (!replaced) {
            nextItems.push(mappedItem);
          }
          return nextItems;
        });
        toast.success("Schedule item updated");
      } else {
        setScheduleItems((current) => [...current, mappedItem]);
        toast.success("Schedule item created");
      }

      return true;
    },
    [scheduleDays, setScheduleItems],
  );

  const deleteScheduleItemByID = useCallback(
    async (itemID: string | null) => {
      if (!itemID) {
        return false;
      }

      setDeletingItem(true);
      const response = await deleteScheduleItem(itemID);
      setDeletingItem(false);

      if (response.status !== 204) {
        errorAlert(response);
        return false;
      }

      setScheduleItems((current) =>
        current.filter((item) => item.id !== itemID),
      );
      toast.success("Schedule item deleted");
      return true;
    },
    [setScheduleItems],
  );

  return {
    creatingItem,
    deletingItem,
    saveScheduleItem,
    deleteScheduleItemByID,
  };
}
