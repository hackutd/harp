import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isValidReferralCode,
  REFERRAL_PARAM,
  referralLink,
} from "@/shared/lib/referral";

import { CopyLinkButton } from "./components/CopyLinkButton";
import { SignupsDialog } from "./components/SignupsDialog";
import { useReferralsStore } from "./store";
import type { Referral } from "./types";

const CODE_HELP = "3–64 letters, digits, - or _";

interface FormState {
  name: string;
  code: string;
}

const EMPTY_FORM: FormState = { name: "", code: "" };

export default function ReferralsPage() {
  const referrals = useReferralsStore((s) => s.referrals);
  const loading = useReferralsStore((s) => s.loading);
  const saving = useReferralsStore((s) => s.saving);
  const fetch = useReferralsStore((s) => s.fetch);
  const createReferral = useReferralsStore((s) => s.createReferral);
  const updateReferral = useReferralsStore((s) => s.updateReferral);
  const deleteReferral = useReferralsStore((s) => s.deleteReferral);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Referral | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // The last referral picked stays set after its dialog closes, so the text
  // doesn't blank out during the close animation.
  const [deleting, setDeleting] = useState<Referral | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewing, setViewing] = useState<Referral | null>(null);
  const [signupsOpen, setSignupsOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(controller.signal);
    return () => controller.abort();
  }, [fetch]);

  const handleStartCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleStartEdit = (referral: Referral) => {
    setEditing(referral);
    setForm({ name: referral.name, code: referral.code });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    const code = form.code.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    // A code is optional on create (the server picks a random one) but
    // required on edit.
    if ((editing || code) && !isValidReferralCode(code)) {
      toast.error(`Code must be ${CODE_HELP}`);
      return;
    }

    if (editing) {
      const ok = await updateReferral(editing.id, { name, code });
      if (ok) {
        toast.success("Referral updated");
        setDialogOpen(false);
      }
      return;
    }

    const created = await createReferral(code ? { name, code } : { name });
    if (created) {
      setDialogOpen(false);
      try {
        await navigator.clipboard.writeText(referralLink(created.code));
        toast.success(`Created "${created.name}" and copied its link`);
      } catch {
        toast.success(`Created "${created.name}"`);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    const ok = await deleteReferral(deleting.id);
    if (ok) {
      toast.success(`Deleted "${deleting.name}"`);
    }
    setDeleteOpen(false);
  };

  const codeChanged = editing !== null && form.code.trim() !== editing.code;

  if (loading && referrals.length === 0) {
    return <Skeleton className="h-72 w-full" />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Referral links</CardTitle>
          <CardDescription>
            Give each influencer or ad its own link to the sign-in page to see
            how many people visit and sign up through it.
          </CardDescription>
          <CardAction>
            <Button size="sm" onClick={handleStartCreate} disabled={saving}>
              <Plus className="size-4" />
              New referral
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Signups</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="font-medium">
                      {referral.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="truncate font-mono text-xs text-muted-foreground">
                          /?{REFERRAL_PARAM}={referral.code}
                        </code>
                        <CopyLinkButton code={referral.code} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {referral.visit_count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {referral.signup_count}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View signups for ${referral.name}`}
                          onClick={() => {
                            setViewing(referral);
                            setSignupsOpen(true);
                          }}
                        >
                          <Users className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${referral.name}`}
                          onClick={() => handleStartEdit(referral)}
                          disabled={saving}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${referral.name}`}
                          onClick={() => {
                            setDeleting(referral);
                            setDeleteOpen(true);
                          }}
                          disabled={saving}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit referral" : "New referral"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Rename this referral or change its link."
                : "The link gets a random code unless you set one."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="referral-name">Name</Label>
              <Input
                id="referral-name"
                placeholder="Kai Codes (TikTok)"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referral-code">
                Code{" "}
                {!editing && (
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                )}
              </Label>
              <Input
                id="referral-code"
                placeholder={editing ? undefined : "Random"}
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {codeChanged
                  ? "Links already shared with the old code will stop counting. Existing signups are kept."
                  : `${CODE_HELP}. A readable code like "kaicodes" shows applicants who sent them, so leave it random unless you need it.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {editing ? "Save changes" : "Create link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Its link stops working and its{" "}
              {deleting?.signup_count === 1
                ? "1 signup loses"
                : `${deleting?.signup_count ?? 0} signups lose`}{" "}
              their attribution. The accounts themselves are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SignupsDialog
        referral={viewing}
        open={signupsOpen}
        onOpenChange={setSignupsOpen}
      />
    </>
  );
}
