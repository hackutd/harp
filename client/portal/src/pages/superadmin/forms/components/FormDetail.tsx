import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CircleDollarSign,
  FilePenLine,
  Inbox,
  Settings2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApplicationPage from "@/pages/superadmin/application/ApplicationPage";
import RSVPPage from "@/pages/superadmin/rsvp/RSVPPage";
import TravelRSVPPage from "@/pages/superadmin/travel-rsvp/TravelRSVPPage";
import { errorAlert } from "@/shared/lib/api";

import { setFormEnabled } from "../api";
import {
  FORM_CONFIG,
  formatCurrency,
  formatDateTime,
  isFormOpen,
} from "../config";
import type { FormDetailTab, FormKey, FormsOverviewData } from "../types";
import { ResponsesTable } from "./ResponsesTable";

interface FormDetailProps {
  form: FormKey;
  data: FormsOverviewData;
  onRefresh: () => Promise<void>;
}

const validTabs = new Set<FormDetailTab>([
  "overview",
  "responses",
  "builder",
  "settings",
]);

const detailTabClassName =
  "relative rounded-none border-0 px-4 py-2.5 font-light text-muted-foreground shadow-none after:absolute after:inset-x-3 after:-bottom-2 after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:font-normal data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:bg-foreground";

function FormMetrics({
  form,
  data,
}: {
  form: FormKey;
  data: FormsOverviewData;
}) {
  if (form === "application") {
    const stats = data.stats.applications;
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ["Started", stats.started],
          ["Submitted", stats.submitted],
          ["Awaiting decision", stats.awaiting_decision],
          ["Accepted", stats.accepted],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-light">
              Application completion
            </CardTitle>
            <CardDescription className="font-light">
              Submitted applications compared with everyone who started.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm font-light">
              <span>{stats.drafts} drafts remain</span>
              <span>{stats.completion_rate.toFixed(1)}%</span>
            </div>
            <Progress value={stats.completion_rate} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (form === "rsvp") {
    const stats = data.stats.rsvp;
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ["Eligible", stats.eligible],
          ["Awaiting response", stats.pending],
          ["Confirmed", stats.confirmed],
          ["Declined", stats.declined],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base font-light">
              RSVP response rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 font-light">
            <div className="flex justify-between text-sm">
              <span>{stats.confirmed + stats.declined} people responded</span>
              <span>{stats.response_rate.toFixed(1)}%</span>
            </div>
            <Progress value={stats.response_rate} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data.stats.travel;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          ["Requested", stats.requested],
          ["Decision pending", stats.decision_pending],
          ["Approved people", stats.approved],
          ["People with receipts", stats.people_with_receipts],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-light tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-light">
            <CircleDollarSign className="size-5 text-muted-foreground" />
            Funding position
          </CardTitle>
          <CardDescription className="font-light">
            The approved commitment is the sum of each person’s individually
            approved amount—not the sum they requested.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            ["Requested estimate", stats.requested_estimate_cents],
            ["Approved commitment", stats.approved_amount_cents],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-light tabular-nums">
                {formatCurrency(value as number)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Builder({ form }: { form: FormKey }) {
  if (form === "application") return <ApplicationPage />;
  if (form === "rsvp") return <RSVPPage />;
  return <TravelRSVPPage />;
}

export function FormDetail({ form, data, onRefresh }: FormDetailProps) {
  const config = FORM_CONFIG[form];
  const availability = data[form];
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as FormDetailTab | null;
  const activeTab =
    requestedTab && validTabs.has(requestedTab) ? requestedTab : "overview";
  const [availabilityDialog, setAvailabilityDialog] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const effectiveOpen = isFormOpen(form, availability);

  const changeTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const toggleAvailability = async () => {
    setSavingAvailability(true);
    const result = await setFormEnabled(form, !availability.enabled);
    setSavingAvailability(false);
    if (result.status === 200) {
      toast.success(
        `${config.title} ${availability.enabled ? "disabled" : "enabled"}`,
      );
      setAvailabilityDialog(false);
      await onRefresh();
    } else {
      errorAlert(result);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 font-light">
      <Tabs
        value={activeTab}
        onValueChange={changeTab}
        className="min-h-0 flex-1 overflow-hidden"
      >
        <div className="flex shrink-0 flex-col gap-3 border-b pb-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link to="/admin/sa/forms" aria-label="Back to all forms">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <TabsList className="h-auto min-w-0 flex-1 justify-start overflow-x-auto rounded-none border-0 bg-transparent p-0">
              <TabsTrigger value="overview" className={detailTabClassName}>
                <BarChart3 /> Overview
              </TabsTrigger>
              <TabsTrigger value="responses" className={detailTabClassName}>
                <Inbox /> Responses
              </TabsTrigger>
              <TabsTrigger value="builder" className={detailTabClassName}>
                <FilePenLine /> Builder
              </TabsTrigger>
              <TabsTrigger value="settings" className={detailTabClassName}>
                <Settings2 /> Settings
              </TabsTrigger>
            </TabsList>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-light">Accepting responses</p>
              <p className="text-xs font-light text-muted-foreground">
                Permission is {availability.enabled ? "enabled" : "disabled"}
              </p>
            </div>
            <Switch
              checked={availability.enabled}
              onCheckedChange={() => setAvailabilityDialog(true)}
              aria-label={`Toggle ${config.title}`}
            />
          </div>
        </div>
        <TabsContent
          value="overview"
          className="mt-3 min-h-0 overflow-y-auto pb-1"
        >
          <FormMetrics form={form} data={data} />
        </TabsContent>
        <TabsContent value="responses" className="mt-3 min-h-0">
          <ResponsesTable form={form} onSummaryRefresh={onRefresh} />
        </TabsContent>
        <TabsContent
          value="builder"
          className="mt-3 flex min-h-0 overflow-hidden"
        >
          <Builder form={form} />
        </TabsContent>
        <TabsContent
          value="settings"
          className="mt-3 min-h-0 overflow-y-auto pb-1"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-light">
                  Availability
                </CardTitle>
                <CardDescription className="text-xs font-light">
                  The permission gate hackers encounter before opening this
                  form.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-light">Form permission</p>
                    <p className="text-xs font-light text-muted-foreground">
                      {availability.enabled ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                  <Switch
                    checked={availability.enabled}
                    onCheckedChange={() => setAvailabilityDialog(true)}
                  />
                </div>
                {form === "application" && (
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-light">Application deadline</p>
                    <p className="mt-1 text-xs font-light text-muted-foreground">
                      {formatDateTime(availability.due_date)}
                    </p>
                    {availability.enabled && !effectiveOpen && (
                      <p className="mt-2 flex items-start gap-2 text-xs text-amber-700">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        Permission is enabled, but the deadline has passed, so
                        the form is effectively closed.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-light">
                  <Users className="size-3.5" /> Eligibility
                </CardTitle>
                <CardDescription className="text-xs font-light">
                  Who can reach this form when its permission is enabled.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-light">{config.audience}</p>
                  <p className="mt-1 text-xs font-light text-muted-foreground">
                    {form === "application"
                      ? "Any authenticated hacker can start an application."
                      : form === "rsvp"
                        ? "Only hackers with an accepted application can respond."
                        : "Only confirmed attendees with approved travel can submit travel details and receipts."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={availabilityDialog}
        onOpenChange={setAvailabilityDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {availability.enabled ? "Disable" : "Enable"} {config.title}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {availability.enabled
                ? `Hackers in the ${config.audience.toLowerCase()} audience will no longer be able to submit this form. Existing responses are preserved.`
                : `Hackers in the ${config.audience.toLowerCase()} audience will be able to access and submit this form immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingAvailability}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={savingAvailability}
              onClick={(event) => {
                event.preventDefault();
                toggleAvailability();
              }}
              className={
                availability.enabled
                  ? "bg-destructive hover:bg-destructive/90"
                  : ""
              }
            >
              {availability.enabled ? "Disable form" : "Enable form"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
