import { ExternalLink, FileText } from "lucide-react";
import { memo, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { formatResponseValue, isFieldVisible } from "@/shared/lib/schema-utils";
import type { Application, ApplicationSchemaField } from "@/types";

import {
  fetchTravelReceiptURLs,
  fetchTravelRSVPSchema,
  type TravelReceiptURL,
} from "../api";

interface TravelRSVPSectionProps {
  application: Application;
}

/**
 * Proof-of-travel block for the super admin grading page: shows the hacker's
 * travel RSVP answers (mode, flights, cost, payment) and signed links to their
 * uploaded receipts so travel decisions can be verified.
 */
export const TravelRSVPSection = memo(function TravelRSVPSection({
  application,
}: TravelRSVPSectionProps) {
  const [schema, setSchema] = useState<ApplicationSchemaField[]>([]);
  const [receipts, setReceipts] = useState<TravelReceiptURL[]>([]);

  const confirmed = application.travel_rsvp_status === "confirmed";
  const hasReceipts = (application.travel_receipt_paths ?? []).length > 0;

  useEffect(() => {
    if (!confirmed) return;
    const controller = new AbortController();
    fetchTravelRSVPSchema(controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) setSchema(res.data.fields ?? []);
    });
    return () => controller.abort();
  }, [confirmed]);

  useEffect(() => {
    if (!confirmed || !hasReceipts) return;
    const controller = new AbortController();
    fetchTravelReceiptURLs(application.id, controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) setReceipts(res.data.receipts ?? []);
    });
    return () => controller.abort();
  }, [confirmed, hasReceipts, application.id]);

  if (application.travel_status !== "approved") return null;

  if (!confirmed) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          Travel RSVP
        </h3>
        <p className="text-sm text-muted-foreground italic">
          {application.travel_rsvp_status === "declined"
            ? "Hacker declined the travel reimbursement."
            : "Travel form not submitted yet."}
        </p>
      </div>
    );
  }

  const responses = application.travel_rsvp_responses ?? {};
  const answeredFields = schema.filter((f) => isFieldVisible(f, responses));

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">
        Travel RSVP
      </h3>
      <div className="space-y-3">
        <Badge className="bg-green-100 text-green-800">
          Travel details submitted
        </Badge>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {answeredFields.map((field) => (
            <div key={field.id}>
              <Label className="text-muted-foreground text-xs">
                {field.label}
              </Label>
              <p>{formatResponseValue(responses[field.id], field)}</p>
            </div>
          ))}
        </div>

        <div>
          <Label className="text-muted-foreground text-xs">Receipts</Label>
          {hasReceipts ? (
            <div className="mt-1 space-y-1">
              {receipts.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Loading receipts...
                </p>
              ) : (
                receipts.map((receipt, index) => (
                  <a
                    key={receipt.path}
                    href={receipt.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Receipt {index + 1}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic mt-1">
              No receipts uploaded
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
