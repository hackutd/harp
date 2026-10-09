import { Suspense } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router";

import {
  CardGridSkeleton,
  DirectoryGate,
  DirectoryHeader,
  type DirectoryTab,
} from "./components/DirectoryShell";
import { MatchDialog } from "./components/MatchDialog";

// Start fetching both tabs while the gate checks eligibility, rather than
// after it, so the first visit doesn't wait on a second chunk.
void import("./DirectoryPage");
void import("./ContactsPage");

const TITLES: Record<DirectoryTab, string> = {
  browse: "Directory",
  pokes: "Pokes",
  contacts: "My contacts",
};

// Browse, Pokes and My contacts share this shell, so switching tabs keeps
// the gate, header and tab bar mounted and only swaps the list below them.
export default function DirectoryLayout() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const tab: DirectoryTab = pathname.endsWith("/contacts")
    ? "contacts"
    : params.get("tab") === "pokes"
      ? "pokes"
      : "browse";

  return (
    <div className="min-h-svh px-5 pt-6 pb-8 text-ink md:px-8 md:pt-10">
      <DirectoryGate>
        {(me) => (
          <>
            <DirectoryHeader title={TITLES[tab]} active={tab} />
            <Suspense fallback={<CardGridSkeleton className="mt-4" />}>
              <div
                key={tab}
                className="animate-in duration-200 fade-in-0 motion-reduce:animate-none"
              >
                <Outlet context={me} />
              </div>
            </Suspense>
            <MatchDialog />
          </>
        )}
      </DirectoryGate>
    </div>
  );
}
