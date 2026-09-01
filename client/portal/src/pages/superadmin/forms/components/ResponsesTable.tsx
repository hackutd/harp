import { FileText, ReceiptText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchBar } from "@/pages/admin/_shared";
import { PaginationControls } from "@/pages/admin/all-applicants/components/PaginationControls";
import type {
  ApplicationListItem,
  ApplicationStatus,
  FetchParams,
} from "@/pages/admin/all-applicants/types";
import { formatName } from "@/pages/admin/all-applicants/utils";
import type { RSVPStatus, TravelStatus } from "@/types";

import { fetchFormResponses } from "../api";
import { FORM_CONFIG, formatCurrency, formatDateTime } from "../config";
import type { FormKey } from "../types";
import { ResponseDetailSheet } from "./ResponseDetailSheet";

interface ResponsesTableProps {
  form: FormKey;
  onSummaryRefresh: () => Promise<void>;
}

type ApplicationFilter = ApplicationStatus | "all";
type RSVPFilter = RSVPStatus | "all";
type TravelFilter = TravelStatus | "all";
type ReceiptFilter = "all" | "with" | "without";

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  waitlisted: "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  declined: "bg-amber-100 text-amber-700",
  not_requested: "bg-slate-100 text-slate-700",
  approved: "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      className={`${statusStyles[value] ?? statusStyles.pending} capitalize`}
    >
      {value.replace("_", " ")}
    </Badge>
  );
}

function ResponseColumns({ form }: { form: FormKey }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="pl-6">Person</TableHead>
        {form === "application" && <TableHead>Application</TableHead>}
        {form === "travel" && <TableHead>Travel decision</TableHead>}
        {form === "travel" && <TableHead>Requested</TableHead>}
        {form === "travel" && <TableHead>Approved</TableHead>}
        {form === "travel" && <TableHead>Receipts</TableHead>}
        {form !== "application" && <TableHead>Form status</TableHead>}
        <TableHead>Submitted</TableHead>
      </TableRow>
    </TableHeader>
  );
}

function ResponseRow({
  form,
  item,
  onSelect,
}: {
  form: FormKey;
  item: ApplicationListItem;
  onSelect: () => void;
}) {
  const submittedAt =
    form === "application"
      ? item.submitted_at
      : form === "rsvp"
        ? item.rsvp_submitted_at
        : item.travel_rsvp_submitted_at;

  return (
    <TableRow
      role="button"
      tabIndex={0}
      className="cursor-pointer"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onSelect();
      }}
    >
      <TableCell className="pl-6">
        <div className="max-w-56">
          <p className="truncate font-medium">
            {formatName(item.first_name, item.last_name)}
          </p>
          <p className="truncate text-xs text-muted-foreground">{item.email}</p>
        </div>
      </TableCell>
      {form === "application" && (
        <TableCell>
          <StatusBadge value={item.status} />
        </TableCell>
      )}
      {form === "travel" && (
        <TableCell>
          <StatusBadge value={item.travel_status} />
        </TableCell>
      )}
      {form === "travel" && (
        <TableCell className="tabular-nums">
          {formatCurrency(item.estimated_travel_cost_cents)}
        </TableCell>
      )}
      {form === "travel" && (
        <TableCell className="font-medium tabular-nums">
          {formatCurrency(item.travel_approved_amount_cents)}
        </TableCell>
      )}
      {form === "travel" && (
        <TableCell>
          <span className="inline-flex items-center gap-1.5">
            <ReceiptText className="size-3.5 text-muted-foreground" />
            {item.receipt_count}
          </span>
        </TableCell>
      )}
      {form !== "application" && (
        <TableCell>
          <StatusBadge
            value={form === "rsvp" ? item.rsvp_status : item.travel_rsvp_status}
          />
        </TableCell>
      )}
      <TableCell className="text-muted-foreground">
        {formatDateTime(submittedAt)}
      </TableCell>
    </TableRow>
  );
}

export function ResponsesTable({
  form,
  onSummaryRefresh,
}: ResponsesTableProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "all";
  const [applicationStatus, setApplicationStatus] = useState<ApplicationFilter>(
    form === "application" ? (initialStatus as ApplicationFilter) : "all",
  );
  const [responseStatus, setResponseStatus] = useState<RSVPFilter>(
    form === "application" ? "all" : (initialStatus as RSVPFilter),
  );
  const [travelStatus, setTravelStatus] = useState<TravelFilter>(
    (searchParams.get("travel_status") as TravelFilter) ?? "all",
  );
  const [receiptFilter, setReceiptFilter] = useState<ReceiptFilter>(() => {
    const value = searchParams.get("has_receipts");
    return value === "true" ? "with" : value === "false" ? "without" : "all";
  });
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [items, setItems] = useState<ApplicationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeCursor = useRef<Pick<FetchParams, "cursor" | "direction">>({});
  const requestCounter = useRef(0);

  const buildFilters = useCallback((): FetchParams => {
    const filters: FetchParams = {};
    if (search.trim().length >= 2) filters.search = search.trim();
    if (form === "application" && applicationStatus !== "all") {
      filters.status = applicationStatus;
    }
    if (form === "rsvp" && responseStatus !== "all") {
      filters.rsvp_status = responseStatus;
    }
    if (form === "travel") {
      if (responseStatus !== "all") filters.travel_rsvp_status = responseStatus;
      if (travelStatus !== "all") filters.travel_status = travelStatus;
      if (receiptFilter !== "all") {
        filters.has_receipts = receiptFilter === "with";
      }
    }
    return filters;
  }, [
    applicationStatus,
    form,
    receiptFilter,
    responseStatus,
    search,
    travelStatus,
  ]);

  const loadResponses = useCallback(
    async (page: Pick<FetchParams, "cursor" | "direction"> = {}) => {
      const requestId = ++requestCounter.current;
      setLoading(true);
      const result = await fetchFormResponses(form, {
        ...buildFilters(),
        ...page,
      });
      if (requestId !== requestCounter.current) return;
      if (result.status === 200 && result.data) {
        setItems(result.data.applications ?? []);
        setNextCursor(result.data.next_cursor ?? null);
        setPrevCursor(result.data.prev_cursor ?? null);
        activeCursor.current = page;
      } else {
        setItems([]);
        setNextCursor(null);
        setPrevCursor(null);
      }
      setLoading(false);
    },
    [buildFilters, form],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => loadResponses(), 300);
    return () => window.clearTimeout(timer);
  }, [loadResponses]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (form === "application") {
      if (applicationStatus === "all") next.delete("status");
      else next.set("status", applicationStatus);
    } else {
      if (responseStatus === "all") next.delete("status");
      else next.set("status", responseStatus);
    }
    if (form === "travel") {
      if (travelStatus === "all") next.delete("travel_status");
      else next.set("travel_status", travelStatus);
      if (receiptFilter === "all") next.delete("has_receipts");
      else next.set("has_receipts", String(receiptFilter === "with"));
    }
    if (search.trim().length >= 2) next.set("search", search.trim());
    else next.delete("search");
    setSearchParams(next, { replace: true });
    // searchParams intentionally excluded: it is the value being synchronized.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    applicationStatus,
    form,
    receiptFilter,
    responseStatus,
    search,
    travelStatus,
  ]);

  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : null;

  return (
    <>
      <Card className="min-h-0 overflow-hidden">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base">
                {FORM_CONFIG[form].pluralTitle}
              </CardTitle>
              <CardDescription>
                One row per person. Select a row to review all submitted
                answers.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchBar value={search} onChange={setSearch} />
              {form === "application" && (
                <Select
                  value={applicationStatus}
                  onValueChange={(value) =>
                    setApplicationStatus(value as ApplicationFilter)
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="submitted">Awaiting decision</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="waitlisted">Waitlisted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {form !== "application" && (
                <Select
                  value={responseStatus}
                  onValueChange={(value) =>
                    setResponseStatus(value as RSVPFilter)
                  }
                >
                  <SelectTrigger size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All form statuses</SelectItem>
                    <SelectItem value="pending">Not submitted</SelectItem>
                    <SelectItem value="confirmed">Submitted</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {form === "travel" && (
                <>
                  <Select
                    value={travelStatus}
                    onValueChange={(value) =>
                      setTravelStatus(value as TravelFilter)
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All decisions</SelectItem>
                      <SelectItem value="pending">Decision pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={receiptFilter}
                    onValueChange={(value) =>
                      setReceiptFilter(value as ReceiptFilter)
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All receipts</SelectItem>
                      <SelectItem value="with">Has receipts</SelectItem>
                      <SelectItem value="without">No receipts</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(7)].map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length > 0 ? (
            <Table>
              <ResponseColumns form={form} />
              <TableBody>
                {items.map((item) => (
                  <ResponseRow
                    key={item.id}
                    form={form}
                    item={item}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              {form === "travel" ? (
                <ReceiptText className="mb-3 size-9 text-muted-foreground/50" />
              ) : (
                <FileText className="mb-3 size-9 text-muted-foreground/50" />
              )}
              <p className="font-medium">No matching people</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try changing the response filters or search.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${items.length} people on this page`}
            </p>
            <PaginationControls
              prevCursor={prevCursor}
              nextCursor={nextCursor}
              loading={loading}
              onPrevPage={() =>
                prevCursor &&
                loadResponses({ cursor: prevCursor, direction: "backward" })
              }
              onNextPage={() =>
                nextCursor &&
                loadResponses({ cursor: nextCursor, direction: "forward" })
              }
            />
          </div>
        </CardContent>
      </Card>

      <ResponseDetailSheet
        form={form}
        item={selectedItem}
        open={selectedItem != null}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedId(null)}
        canPrevious={selectedIndex > 0}
        canNext={selectedIndex >= 0 && selectedIndex < items.length - 1}
        onPrevious={() =>
          selectedIndex > 0 && setSelectedId(items[selectedIndex - 1].id)
        }
        onNext={() =>
          selectedIndex < items.length - 1 &&
          setSelectedId(items[selectedIndex + 1].id)
        }
        onUpdated={() => {
          loadResponses(activeCursor.current);
          onSummaryRefresh();
        }}
      />
    </>
  );
}
