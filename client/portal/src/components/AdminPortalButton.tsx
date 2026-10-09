import { IconShieldCheck } from "@tabler/icons-react";
import { Link } from "react-router";

import { useIsMobile } from "@/shared/hooks";
import { useUserStore } from "@/shared/stores";

/**
 * Renders a link to the admin portal, but only for users with the
 * `admin` or `super_admin` role. Returns null for everyone else.
 *
 * Styled to match the list rows on the Profile page. On mobile,
 * admin work is scanning, so this jumps to the mobile scanner tab on the
 * hacker Scan page; on desktop it opens the full portal at All Applicants.
 */
export function AdminPortalButton() {
  const { user } = useUserStore();
  const isMobile = useIsMobile();

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return null;
  }

  const target = isMobile ? "/app/scan?tab=scanner" : "/admin/all-applicants";

  return (
    <section>
      <h2 className="mb-2 text-sm font-light text-ink/65">Admin</h2>
      <div className="divide-y divide-ink/10 overflow-hidden rounded-xl bg-surface theme-light:border theme-light:border-ink/10">
        <Link
          to={target}
          className="flex min-h-[68px] w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-2"
        >
          <IconShieldCheck className="size-4.5 text-ink" strokeWidth={1.5} />
          <span className="text-sm font-normal text-ink">Admin Portal</span>
        </Link>
      </div>
    </section>
  );
}
