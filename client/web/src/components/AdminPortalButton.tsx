import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useUserStore } from "@/shared/stores";

/**
 * Renders a link to the admin portal, but only for users with the
 * `admin` or `super_admin` role. Returns null for everyone else.
 */
export function AdminPortalButton() {
  const { user } = useUserStore();

  if (user?.role !== "admin" && user?.role !== "super_admin") {
    return null;
  }

  return (
    <Button asChild variant="outline">
      <Link to="/admin/all-applicants">
        <ShieldCheck className="h-4 w-4" />
        Admin Portal
      </Link>
    </Button>
  );
}
