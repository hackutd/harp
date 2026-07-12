import {
  Bell,
  Calendar,
  ChevronRight,
  HelpCircle,
  Mail,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getRequest } from "@/shared/lib/api";
import type { Application, ApplicationStatus } from "@/types";

interface ImportantDate {
  month: string;
  day: string;
  label: string;
}

const IMPORTANT_DATES: ImportantDate[] = [
  { month: "Mar", day: "14", label: "App due" },
  { month: "Mar", day: "20", label: "Decisions" },
  { month: "Apr", day: "04", label: "Kickoff" },
];

const QUICK_LINKS = [
  { label: "Help", icon: HelpCircle, href: "mailto:hello@hackutd.co" },
  { label: "Contact", icon: Mail, href: "mailto:hello@hackutd.co" },
  { label: "FAQ", icon: MessageSquare, href: "https://hackutd.co" },
];

const STATUS_BADGES: Record<ApplicationStatus, string> = {
  draft: "In progress",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Decided",
  waitlisted: "Waitlisted",
};

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
  const [application, setApplication] = useState<Application | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await getRequest<Application>(
        "/applications/me",
        "application",
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setApplication(res.data);
      }
    };
    load();
    return () => controller.abort();
  }, []);

  const percent = completionPercent(application);
  const badge = application ? STATUS_BADGES[application.status] : "Not started";
  const isDraft = !application || application.status === "draft";

  const notifications = [
    application?.status === "draft"
      ? {
          title: "Application progress saved",
          body: "You can pick up where you left off",
          active: true,
        }
      : application
        ? {
            title: `Application ${application.status}`,
            body: "Check your status for details",
            active: true,
          }
        : {
            title: "Start your application",
            body: "Applications for HackUTD 2026 are open",
            active: true,
          },
    {
      title: "Decisions go out Mar 20",
      body: "Keep an eye on your email",
      active: false,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-5 pt-4 pb-6 md:px-8 md:pt-6">
      {/* Top icons */}
      <div className="mb-3 flex items-center justify-end gap-4">
        <Link
          to="/app/schedule"
          aria-label="Schedule"
          className="text-black active:scale-[0.98]"
        >
          <Calendar className="size-5.5" strokeWidth={1.5} />
        </Link>
        <button aria-label="Notifications" className="relative text-black">
          <Bell className="size-5.5" strokeWidth={1.5} />
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500" />
        </button>
      </div>

      {/* Application status card */}
      <div className="rounded-xl bg-[#3A3A38] p-5 text-white">
        <span className="inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium tracking-widest uppercase">
          {badge}
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          HackUTD 2026
        </h1>
        <p className="mt-1 text-sm font-light text-white/70">
          Application {percent}% complete
        </p>
        <div className="mt-3 h-1 w-full rounded-full bg-white/20">
          <div
            className="h-1 rounded-full bg-white transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <Link
          to={isDraft ? "/app/apply" : "/app/status"}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-medium text-black active:scale-[0.98]"
        >
          {isDraft ? "Continue" : "View status"}
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </Link>
      </div>

      {/* Important dates */}
      <section className="mt-5">
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
          {IMPORTANT_DATES.map((d) => (
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
        <h2 className="mb-2.5 text-lg font-medium text-black">Notifications</h2>
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.title}
              className="flex items-start gap-3 rounded-lg border border-[#E5E5E5] bg-white px-4 py-3.5"
            >
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${
                  n.active ? "bg-black" : "bg-[#C4C4C4]"
                }`}
              />
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
        {QUICK_LINKS.map(({ label, icon: Icon, href }) => (
          <a
            key={label}
            href={href}
            className="flex flex-col items-start gap-2 rounded-lg border border-[#E5E5E5] bg-white p-4 active:scale-[0.98]"
          >
            <Icon className="size-5 text-black" strokeWidth={1.5} />
            <span className="text-sm font-normal text-black">{label}</span>
          </a>
        ))}
      </section>
    </div>
  );
}
