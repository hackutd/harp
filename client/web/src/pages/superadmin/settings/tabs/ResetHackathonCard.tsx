import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetHackathon } from "../api";

export function ResetHackathonCard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [options, setOptions] = useState({
    reset_applications: false,
    reset_scans: false,
    reset_schedule: false,
    reset_settings: false,
  });

  const handleReset = async () => {
    if (confirmText !== "RESET HACKATHON") return;

    // Ensure at least one option is selected
    if (!Object.values(options).some(Boolean)) {
      toast.error("Please select at least one item to reset");
      return;
    }

    setLoading(true);
    try {
      const res = await resetHackathon(options);

      if (res.error) {
        toast.error(res.error);
        return;
      }

      toast.success("Hackathon data reset successfully");
      setOpen(false);
      setConfirmText("");
      setOptions({
        reset_applications: false,
        reset_scans: false,
        reset_schedule: false,
        reset_settings: false,
      });
    } catch (err) {
      toast.error(
        "An unexpected error occurred" +
          (err instanceof Error ? `: ${err.message}` : ""),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800 border-0 rounded-md">
      <CardHeader>
        <CardTitle className="text-red-500 flex items-center gap-2">
          <AlertTriangle className="size-5" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Irreversible actions that destroy data. Proceed with caution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full sm:w-auto">
              <Trash2 className="mr-2 size-4" />
              Reset Hackathon Data
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-red-500 flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Reset Hackathon Data
              </DialogTitle>
              <DialogDescription className="text-zinc-400">
                This action cannot be undone. This will permanently delete the
                selected data from the database and remove associated files.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-3 border border-zinc-800 rounded-md p-4 bg-zinc-950/50">
                {[
                  {
                    id: "reset_applications",
                    label: "Applications",
                    desc: "Deletes all hacker applications, reviews, and resume files.",
                  },
                  {
                    id: "reset_scans",
                    label: "Scans",
                    desc: "Deletes all check-in, meal, and event scan records.",
                  },
                  {
                    id: "reset_schedule",
                    label: "Schedule",
                    desc: "Deletes all schedule events.",
                  },
                  {
                    id: "reset_settings",
                    label: "Settings Stats",
                    desc: "Resets scan stats and review assignment toggles.",
                  },
                ].map((item) => (
                  <div key={item.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={item.id}
                      checked={options[item.id as keyof typeof options]}
                      onCheckedChange={(c) =>
                        setOptions((prev) => ({
                          ...prev,
                          [item.id]: !!c,
                        }))
                      }
                      className="border-zinc-600 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={item.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-zinc-200"
                      >
                        {item.label}
                      </Label>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-zinc-200">
                  Type <strong className="text-red-500">RESET HACKATHON</strong>{" "}
                  to confirm
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET HACKATHON"
                  className="bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-red-500/20 focus-visible:border-red-500"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={
                  loading ||
                  confirmText !== "RESET HACKATHON" ||
                  !Object.values(options).some(Boolean)
                }
                className="bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Reset Data
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
