import type { LucideIcon } from "lucide-react";
import { BookOpen, ChevronRight, Mail, MessageSquare } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import { CelebrationEffect } from "@/components/CelebrationEffect";
import { getRequest } from "@/shared/lib/api";
import { parseDateOnly } from "@/shared/lib/datetime";
import type { Application, NotificationFeedItem } from "@/types";

import { ApplicationStatusCards } from "../components/ApplicationStatusCards";
import { fetchHackerPackURL } from "../hacker-pack/api";
import { getNotificationFeed } from "../notifications/api";
import type { HackathonConfig } from "./api";
import { fetchApplicationsEnabled, fetchHackathonConfig } from "./api";

interface ImportantDate {
  month: string;
  day: string;
  label: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Unconfigured dates are simply omitted rather than shown as placeholders.
function importantDates(config: HackathonConfig | null): ImportantDate[] {
  if (!config) return [];
  return (
    [
      { value: config.application_due_date, label: "App due" },
      { value: config.start_date ?? "", label: "Kickoff" },
    ] as const
  ).flatMap(({ value, label }) => {
    const date = parseDateOnly(value);
    if (!date) return [];
    return [
      {
        month: MONTHS[date.getMonth()],
        day: String(date.getDate()).padStart(2, "0"),
        label,
      },
    ];
  });
}

interface QuickLink {
  label: string;
  icon: LucideIcon;
  href?: string;
  to?: string;
}

const QUICK_LINKS: Omit<QuickLink, "href">[] = [
  { label: "Hacker Pack", icon: BookOpen, to: "/app/hacker-pack" },
  { label: "FAQ", icon: MessageSquare, to: "/app/faq" },
  { label: "Contact", icon: Mail },
];

// Pre-decision states for the neutral hackathon card. Once a decision exists
// the dashboard renders the shared status cards instead, so the decided
// branch here is just a fallback.
function dashboardStatus(application: Application | null): {
  label: string;
  color: string;
} {
  if (!application) return { label: "Not started", color: "bg-white/15" };
  switch (application.status) {
    case "draft":
      return { label: "In progress", color: "bg-gray-100 text-gray-800" };
    case "submitted":
      return { label: "Under review", color: "bg-white/15" };
    default:
      return {
        label: "Decisions are out",
        color: "bg-[#7A7973] text-white",
      };
  }
}

function completionPercent(application: Application | null): number {
  if (!application) return 0;
  if (application.status !== "draft") return 100;
  const fields = application.application_schema ?? [];
  if (fields.length === 0) return 0;
  const responses = application.responses ?? {};
  const filled = fields.filter((f) => {
    const value = responses[f.id];
    if (value == null) return false;
    if (typeof value === "string") return value.trim() !== "";
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }).length;
  return Math.round((filled / fields.length) * 100);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [application, setApplication] = useState<Application | null>(null);
  const [feed, setFeed] = useState<NotificationFeedItem[]>([]);
  const [hackerPackURL, setHackerPackURL] = useState("");
  const [config, setConfig] = useState<HackathonConfig | null>(null);
  // null until the flag loads — the closed state only renders once we know
  // applications really are closed, so the card never flashes the wrong copy.
  const [applicationsEnabled, setApplicationsEnabled] = useState<
    boolean | null
  >(null);

  // Grab the "justSubmitted" ID from navigation state then clear it
  // so back-navigation doesn't re-trigger the submit celebration.
  const justSubmittedId = (location.state as { justSubmitted?: string })
    ?.justSubmitted;
  useEffect(() => {
    if (justSubmittedId) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [justSubmittedId, navigate, location.pathname]);

  const hackathonName = config?.hackathon_name || "Hackathon";
  const contactEmail = config?.contact_email ?? "";

  // Desktop browsers with no registered mail handler make the mailto: link a
  // dead click, so also copy the address and confirm it. The href still fires
  // for anyone who does have a mail client.
  const handleCopyEmail = useCallback(async () => {
    if (!contactEmail) return;
    try {
      await navigator.clipboard.writeText(contactEmail);
      toast(`Copied ${contactEmail} to clipboard`);
    } catch {
      // Clipboard unavailable (insecure context or denied) — mailto: handles it
    }
  }, [contactEmail]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const [appRes, feedRes, packRes, configRes, enabledRes] =
        await Promise.all([
          getRequest<Application>(
            "/applications/me",
            "application",
            controller.signal,
          ),
          getNotificationFeed(controller.signal),
          fetchHackerPackURL(controller.signal),
          fetchHackathonConfig(controller.signal),
          fetchApplicationsEnabled(controller.signal),
        ]);
      if (controller.signal.aborted) return;
      if (appRes.status === 200 && appRes.data) {
        setApplication(appRes.data);
      }
      if (feedRes.status === 200 && feedRes.data) {
        setFeed(feedRes.data.notifications ?? []);
      }
      if (packRes.status === 200 && packRes.data) {
        setHackerPackURL(packRes.data.url.trim());
      }
      if (configRes.status === 200 && configRes.data) {
        setConfig(configRes.data);
      }
      if (enabledRes.status === 200 && enabledRes.data) {
        setApplicationsEnabled(enabledRes.data.enabled);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const dates = importantDates(config);
  const percent = completionPercent(application);
  const isDraft = !application || application.status === "draft";
  // Decided applications skip the neutral hackathon card entirely and show
  // the shared status cards (decision, RSVP, travel) right on the dashboard.
  const decided =
    application != null &&
    application.status !== "draft" &&
    application.status !== "submitted";
  // Closing applications only changes the card for hackers who haven't
  // submitted yet — a submitted application keeps showing its review state.
  const applicationsClosed = applicationsEnabled === false && isDraft;
  const status = applicationsClosed
    ? { label: "Applications closed", color: "bg-white/15" }
    : dashboardStatus(application);
  const statusSubtext = isDraft
    ? `Application ${percent}% complete`
    : application?.status === "submitted"
      ? "Your application is under review"
      : null;

  const notifications =
    feed.length > 0
      ? feed.slice(0, 3).map((n) => ({
          title: n.title,
          body: n.body,
        }))
      : [
          applicationsClosed
            ? {
                title: "Applications closed",
                body: "The portal is not accepting submissions right now",
              }
            : application?.status === "draft"
              ? {
                  title: "Application progress saved",
                  body: "You can pick up where you left off",
                }
              : application?.status === "submitted"
                ? {
                    title: "Application under review",
                    body: "We'll email you when decisions are out",
                  }
                : application
                  ? {
                      title: "Decisions are out",
                      body: "View your status to see your decision",
                    }
                  : {
                      title: "Start your application",
                      body: `Applications for ${hackathonName} are open`,
                    },
        ];

  return (
    <div className="mx-auto max-w-2xl px-5 pt-4 pb-6 md:max-w-5xl md:px-8 md:pt-6">
      {/* Submit celebration: fires when the user was just redirected from submit */}
      {application && justSubmittedId === application.id && (
        <CelebrationEffect id={application.id} type="submit" />
      )}

      {/* Once a decision exists the dashboard shows the full status card
          cluster (decision, RSVP, travel) with its one-time celebration;
          before that it keeps the neutral hackathon card. */}
      {decided ? (
        <ApplicationStatusCards application={application} />
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#46453F]/90 bg-[radial-gradient(130%_130%_at_100%_100%,rgba(255,255,255,0.14),rgba(255,255,255,0)_55%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl">
          <span
            className={`inline-block rounded-full px-3 py-1 text-[11px] font-medium tracking-wide ${status.color}`}
          >
            {status.label}
          </span>
          <h1 className="mt-3 text-xl font-light tracking-tight">
            {hackathonName}
          </h1>
          {applicationsClosed ? (
            <p className="mt-1 text-sm font-light text-white/70">
              The application portal is not currently accepting submissions.
              Please check back later.
              {application?.status === "draft" &&
                " Your draft has been saved and will be here when applications reopen."}
              {contactEmail && (
                <>
                  {" "}
                  If you believe this is a mistake, reach out to{" "}
                  <a
                    href={`mailto:${contactEmail}`}
                    onClick={handleCopyEmail}
                    className="text-white underline underline-offset-2"
                  >
                    {contactEmail}
                  </a>
                  .
                </>
              )}
            </p>
          ) : (
            <>
              {statusSubtext && (
                <p className="mt-1 text-sm font-light text-white/70">
                  {statusSubtext}
                </p>
              )}
              {isDraft && (
                <div className="mt-3 h-1 w-full rounded-full bg-white/20">
                  <div
                    className="h-1 rounded-full bg-white transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
              <Link
                to={isDraft ? "/app/apply" : "/app/application"}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-medium text-black active:scale-[0.98]"
              >
                {isDraft ? "Continue" : "View submission"}
                <ChevronRight className="size-4" strokeWidth={1.75} />
              </Link>
            </>
          )}
        </div>
      )}

      {/* Important dates */}
      <section className={dates.length > 0 ? "mt-5" : "hidden"}>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-lg font-medium text-black">Important dates</h2>
          <Link
            to="/app/schedule"
            className="text-sm font-light text-[#6B6B6B] hover:text-black"
          >
            See all
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {dates.map((d) => (
            <div
              key={d.label}
              className="rounded-lg border border-[#E5E5E5] bg-white p-4"
            >
              <p className="text-[11px] font-medium tracking-widest text-[#6B6B6B] uppercase">
                {d.month}
              </p>
              <p className="mt-1 text-2xl font-semibold text-black">{d.day}</p>
              <p className="mt-1 text-xs font-light text-[#6B6B6B]">
                {d.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section className="mt-5">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-lg font-medium text-black">Notifications</h2>
          <Link
            to="/app/notifications"
            className="text-sm font-light text-[#6B6B6B] hover:text-black"
          >
            See all
          </Link>
        </div>
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.title}
              className="flex items-center gap-3 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3.5"
            >
              <span className="size-2 shrink-0 rounded-full bg-black" />
              <div>
                <p className="text-sm font-normal text-black">{n.title}</p>
                <p className="mt-0.5 text-xs font-light text-[#6B6B6B]">
                  {n.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-5 grid grid-cols-3 gap-3">
        {QUICK_LINKS.filter(
          ({ to, label }) =>
            (to !== "/app/hacker-pack" || hackerPackURL) &&
            (label !== "Contact" || contactEmail),
        ).map(({ label, icon: Icon, to }) => {
          const href =
            label === "Contact" ? `mailto:${contactEmail}` : undefined;
          const className =
            "flex flex-col items-start gap-2 rounded-lg border border-[#E5E5E5] bg-white p-4 active:scale-[0.98]";
          const content = (
            <>
              <Icon className="size-5 text-black" strokeWidth={1.5} />
              <span className="text-sm font-normal text-black">{label}</span>
            </>
          );
          return to ? (
            <Link key={label} to={to} className={className}>
              {content}
            </Link>
          ) : (
            <a
              key={label}
              href={href}
              onClick={
                href?.startsWith("mailto:") ? handleCopyEmail : undefined
              }
              className={className}
            >
              {content}
            </a>
          );
        })}
      </section>
    </div>
  );
}
