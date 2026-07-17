import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { useIsMobile } from "@/shared/hooks";
import { useUserStore } from "@/shared/stores";

/**
 * Renders a link to the admin portal, but only for users with the
 * `admin` or `super_admin` role. Returns null for everyone else.
 *
 * Styled to match the bordered list rows on the Profile page. On mobile the
 * admin portal is scan-only (see `AdminLayout`), so this jumps straight to the
 * Scans page; on desktop it opens the full portal at All Applicants.
 */
export function AdminPortalButton() {
  const { user } = useUserStore();
  const isMobile = useIsMobile();

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return null;
  }

  const target = isMobile ? "/admin/scans" : "/admin/all-applicants";

  return (
    <section>
      <h2 className="mb-2 text-xs font-light tracking-widest text-[#8A8A8A] uppercase">
        Admin
      </h2>
      <div className="divide-y divide-[#F0F0F0] rounded-xl border border-[#E5E5E5]">
        <Link
          to={target}
          className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
        >
          <ShieldCheck className="size-4.5 text-black" strokeWidth={1.5} />
          <span className="text-sm font-normal text-black">Admin Portal</span>
        </Link>
      </div>
    </section>
  );
}
