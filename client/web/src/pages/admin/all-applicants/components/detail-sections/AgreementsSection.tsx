import { CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import type { Application } from "@/types";

interface AgreementsSectionProps {
  application: Application;
}

function AgreementItem({
  label,
  checked,
  required = false,
}: {
  label: string;
  checked: boolean;
  required?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
      )}
      <span
        className={cn(
          "text-sm leading-tight",
          !checked && required && "text-red-600",
        )}
      >
        {label}
        {required && <span className="text-muted-foreground ml-1">*</span>}
      </span>
    </div>
  );
}

export function AgreementsSection({ application }: AgreementsSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">
        Agreements & Acknowledgments
      </h4>
      <div className="space-y-2.5">
        <AgreementItem
          label="Understands application does not guarantee admission"
          checked={application.ack_application}
          required
        />
        <AgreementItem
          label="Agreed to MLH Code of Conduct"
          checked={application.ack_mlh_coc}
          required
        />
        <AgreementItem
          label="Authorized sharing info with MLH (Privacy Policy)"
          checked={application.ack_mlh_privacy}
          required
        />
        <AgreementItem
          label="Opted in to MLH promotional emails"
          checked={application.opt_in_mlh_emails}
        />
      </div>
    </div>
  );
}
