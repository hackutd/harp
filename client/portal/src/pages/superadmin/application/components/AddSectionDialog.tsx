import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useApplicationSchemaStore } from "../store";

export function AddSectionDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const addSection = useApplicationSchemaStore((s) => s.addSection);

  const handleAdd = () => {
    if (!label.trim()) return;
    addSection(label.trim());
    setLabel("");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setLabel("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full border-dashed cursor-pointer"
        >
          <Plus className="size-4 mr-2" />
          Add Section
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Section Name</Label>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder="e.g. Travel Information"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleAdd}
            disabled={!label.trim()}
            className="cursor-pointer"
          >
            Add Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
