import { memo, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import {
  buildTimelineSeries,
  formatDayKey,
  type TimelineRange,
  todayKey,
} from "../timeline";
import type { ApplicationStats, ApplicationTimelinePoint } from "../types";

// shadcn's default chart blues; the portal's --chart-* tokens are brand colours.
const chartConfig = {
  started: { label: "Started", color: "oklch(0.809 0.105 251.813)" },
  submitted: { label: "Submitted", color: "oklch(0.623 0.214 259.815)" },
} satisfies ChartConfig;

const RANGE_OPTIONS: { value: TimelineRange; label: string }[] = [
  { value: "90d", label: "Last 3 months" },
  { value: "30d", label: "Last 30 days" },
  { value: "7d", label: "Last 7 days" },
];

const CHART_HEIGHT = "h-[170px]";

interface ApplicationsOverviewProps {
  stats: ApplicationStats | null;
  statsLoading: boolean;
  points: ApplicationTimelinePoint[];
  timeZone: string;
  loading: boolean;
  error: string | null;
}

export const ApplicationsOverview = memo(function ApplicationsOverview({
  points,
  timeZone,
  loading,
  error,
  stats,
  statsLoading,
}: ApplicationsOverviewProps) {
  const [timeRange, setTimeRange] = useState<TimelineRange>("90d");

  const today = todayKey(timeZone);
  const series = useMemo(
    () =>
      buildTimelineSeries(points, {
        range: timeRange,
        cumulative: false,
        today,
      }),
    [points, timeRange, today],
  );

  const kpis = [
    { label: "Total", value: stats?.total_applications ?? 0 },
    { label: "Pending review", value: stats?.submitted ?? 0 },
    { label: "Accepted", value: stats?.accepted ?? 0 },
    {
      label: "Acceptance rate",
      value: `${(stats?.acceptance_rate ?? 0).toFixed(1)}%`,
    },
  ];

  return (
    <Card className="pt-0 pb-3">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-0 sm:flex-row [.border-b]:pb-0">
        <dl className="grid w-full flex-1 grid-cols-2 self-stretch sm:grid-cols-4">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className={cn(
                "grid min-w-0 content-center gap-0.5 px-2 py-2.5 text-center",
                // Rules between stats: every second one in the 2x2 phone
                // grid, every one but the first in the single row.
                i % 2 === 1 && "border-l",
                i > 0 && "sm:border-l",
              )}
            >
              <dt className="truncate text-xs text-muted-foreground">
                {kpi.label}
              </dt>
              <dd className="truncate text-lg font-semibold tabular-nums">
                {statsLoading ? (
                  <Skeleton className="mx-auto h-7 w-14" />
                ) : (
                  kpi.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        <Select
          value={timeRange}
          onValueChange={(v) => setTimeRange(v as TimelineRange)}
        >
          <SelectTrigger
            className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
            aria-label="Select a time range"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {RANGE_OPTIONS.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                className="rounded-lg"
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-6 sm:pt-3">
        {loading ? (
          <Skeleton className={`${CHART_HEIGHT} w-full`} />
        ) : error || series.length === 0 ? (
          <div
            className={`flex ${CHART_HEIGHT} items-center justify-center text-sm text-muted-foreground`}
          >
            {error ?? "No applications yet"}
          </div>
        ) : (
          <div className="relative">
            <ul className="absolute top-1 left-1 z-10 flex items-center gap-3 rounded-md border bg-background/60 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-md">
              {(["started", "submitted"] as const).map((key) => (
                <li key={key} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: chartConfig[key].color }}
                  />
                  {chartConfig[key].label}
                </li>
              ))}
            </ul>
            <ChartContainer
              config={chartConfig}
              className={`aspect-auto ${CHART_HEIGHT} w-full`}
            >
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="fillStarted" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-started)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-started)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                  <linearGradient
                    id="fillSubmitted"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-submitted)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-submitted)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={formatDayKey}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatDayKey(String(value))}
                      indicator="dot"
                    />
                  }
                />
                {/* Not stacked: started and submitted count different events,
                  so a stacked total would mean nothing. */}
                <Area
                  dataKey="started"
                  type="natural"
                  fill="url(#fillStarted)"
                  stroke="var(--color-started)"
                />
                <Area
                  dataKey="submitted"
                  type="natural"
                  fill="url(#fillSubmitted)"
                  stroke="var(--color-submitted)"
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
