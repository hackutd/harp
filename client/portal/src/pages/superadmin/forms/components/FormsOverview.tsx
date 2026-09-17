import {
  ArrowRight,
  CircleDollarSign,
  FileCheck2,
  FileClock,
  ReceiptText,
  RefreshCw,
  Users,
} from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import {
  FORM_CONFIG,
  formatCurrency,
  formatDateTime,
  isFormOpen,
} from "../config";
import type { FormKey, FormsOverviewData } from "../types";

interface FormsOverviewProps {
  data: FormsOverviewData;
  refreshing: boolean;
  onRefresh: () => void;
}

function StatusBadge({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-xs font-normal ${
        open ? "text-emerald-700" : "text-slate-500"
      }`}
    >
      <span
        className={`mr-1.5 size-1.5 rounded-full ${open ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {open ? "Open" : "Closed"}
    </span>
  );
}

function FormCard({ form, data }: { form: FormKey; data: FormsOverviewData }) {
  const config = FORM_CONFIG[form];
  const availability = data[form];
  const Icon = config.icon;

  const primary =
    form === "application"
      ? data.stats.applications.submitted
      : form === "rsvp"
        ? data.stats.rsvp.confirmed
        : data.stats.travel.form_submitted;
  const secondary =
    form === "application"
      ? `${data.stats.applications.drafts} drafts`
      : form === "rsvp"
        ? `${data.stats.rsvp.pending} awaiting response`
        : `${data.stats.travel.form_pending} awaiting form`;
  const rate =
    form === "application"
      ? data.stats.applications.completion_rate
      : form === "rsvp"
        ? data.stats.rsvp.response_rate
        : data.stats.travel.form_eligible > 0
          ? (data.stats.travel.form_submitted /
              data.stats.travel.form_eligible) *
            100
          : 0;
  const latest =
    form === "application"
      ? data.stats.applications.latest_submission
      : form === "rsvp"
        ? data.stats.rsvp.latest_response
        : data.stats.travel.latest_travel_form_submission;

  return (
    <Link
      to={`/admin/sa/forms/${form}`}
      className="group min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={`Manage ${config.title}`}
    >
      <Card className="h-full min-w-0 border-border/70 transition-colors group-hover:border-foreground/30 group-hover:bg-muted/20">
        <CardHeader className="space-y-4 px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <Icon
                className="mt-0.5 size-4.5 shrink-0 text-muted-foreground"
                strokeWidth={1.5}
              />
              <div className="min-w-0">
                <CardTitle className="text-base font-medium">
                  {config.title}
                </CardTitle>
                <CardDescription className="mt-1 truncate text-xs font-normal">
                  {config.audience}
                </CardDescription>
              </div>
            </div>
            <StatusBadge open={isFormOpen(form, availability)} />
          </div>
          <div>
            <p className="text-3xl font-light tabular-nums">{primary}</p>
            <p className="text-sm font-normal text-muted-foreground">
              {form === "application"
                ? "submitted applications"
                : form === "rsvp"
                  ? "confirmed attendees"
                  : "travel forms submitted"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="mt-auto space-y-4 px-5">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-normal text-muted-foreground">
              <span>{secondary}</span>
              <span>{rate.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(rate, 100)} className="h-1" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
            <p className="truncate text-xs font-normal text-muted-foreground">
              Latest: {formatDateTime(latest)}
            </p>
            <ArrowRight
              className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.5}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function FormsOverview({
  data,
  refreshing,
  onRefresh,
}: FormsOverviewProps) {
  const funnel = [
    { label: "Applications", value: data.stats.applications.submitted },
    { label: "Accepted", value: data.stats.applications.accepted },
    { label: "RSVP confirmed", value: data.stats.rsvp.confirmed },
    { label: "Travel approved", value: data.stats.travel.approved },
    { label: "Travel form", value: data.stats.travel.form_submitted },
    { label: "With receipts", value: data.stats.travel.people_with_receipts },
  ];

  const attention = [
    {
      label: "Applications awaiting a decision",
      value: data.stats.applications.awaiting_decision,
      icon: FileClock,
      to: "/admin/sa/reviews",
    },
    {
      label: "Accepted hackers awaiting RSVP",
      value: data.stats.rsvp.pending,
      icon: Users,
      to: "/admin/sa/forms/rsvp?tab=responses&status=pending",
    },
    {
      label: "Travel requests awaiting a decision",
      value: data.stats.travel.decision_pending,
      icon: FileCheck2,
      to: "/admin/sa/forms/travel?tab=responses&travel_status=pending",
    },
    {
      label: "Approved travelers awaiting their form",
      value: data.stats.travel.form_pending,
      icon: ReceiptText,
      to: "/admin/sa/forms/travel?tab=responses&status=pending",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-3">
        {(["application", "rsvp", "travel"] as const).map((form) => (
          <FormCard key={form} form={form} data={data} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Participant funnel
            </CardTitle>
            <CardDescription>
              One view from submitted application through proof of travel.
            </CardDescription>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                disabled={refreshing}
                onClick={onRefresh}
                className="font-light"
              >
                <RefreshCw
                  className={`size-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {funnel.map((step, index) => (
                <div
                  key={step.label}
                  className="relative rounded-lg border p-3"
                >
                  <p className="text-2xl font-semibold tabular-nums">
                    {step.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.label}
                  </p>
                  {index < funnel.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground xl:block" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Needs attention
            </CardTitle>
            <CardDescription>
              Operational queues that still have work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {attention.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <item.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{item.label}</span>
                </span>
                <Badge variant={item.value > 0 ? "default" : "secondary"}>
                  {item.value}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="size-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">
              Travel funding
            </CardTitle>
          </div>
          <CardDescription>
            Requested estimates and committed amounts are intentionally
            separate.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Requested estimate",
              value: data.stats.travel.requested_estimate_cents,
              note: `${data.stats.travel.requested} requests`,
            },
            {
              label: "Approved commitment",
              value: data.stats.travel.approved_amount_cents,
              note: `${data.stats.travel.approved} approved people`,
            },
          ].map((metric) => (
            <div key={metric.label} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {formatCurrency(metric.value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {metric.note}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
