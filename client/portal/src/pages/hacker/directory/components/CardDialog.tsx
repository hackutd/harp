import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

import type { DirectoryCardData } from "../types";
import { DirectoryCard, type DirectoryCardActions } from "./DirectoryCard";

interface CardDialogProps extends DirectoryCardActions {
  card: DirectoryCardData | null;
  busy?: boolean;
  onClose: () => void;
}

// The full card for someone picked from a list. Without handlers it is
// read-only; with them it keeps the card's action row.
export function CardDialog({
  card,
  busy,
  onClose,
  ...actions
}: CardDialogProps) {
  const readOnly = !actions.onPoke && !actions.onToggleContact;
  return (
    <Dialog
      open={card != null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-sm overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-sm md:max-w-2xl">
        {card && (
          <>
            <DialogTitle className="sr-only">{card.display_name}</DialogTitle>
            <DirectoryCard
              card={card}
              busy={busy}
              hideActions={readOnly}
              detailed
              sideBySide
              {...actions}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
