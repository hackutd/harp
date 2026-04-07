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
    <Card className="bg-card border-border border-0 rounded-md">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="size-5" />
          Danger Zone
        </CardTitle>
        <CardDescription className="text-muted-foreground">
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
          <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Reset Hackathon Data
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This action cannot be undone. This will permanently delete the
                selected data from the database and remove associated files.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-3 border border-border rounded-md p-4 bg-background/50">
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
                      className="border-border data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={item.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
                      >
                        {item.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-foreground">
                  Type{" "}
                  <strong className="text-destructive">RESET HACKATHON</strong>{" "}
                  to confirm
                </Label>
                <Input
                  id="confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET HACKATHON"
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-destructive/20 focus-visible:border-destructive"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="bg-transparent border-border text-foreground hover:bg-accent hover:text-accent-foreground"
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
                className=""
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
