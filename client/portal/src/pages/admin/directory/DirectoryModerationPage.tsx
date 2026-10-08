import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/pages/admin/_shared";

import { HideCardDialog } from "./components/HideCardDialog";
import { ModerationTable } from "./components/ModerationTable";
import { useDirectoryModerationStore } from "./store";
import type { DirectoryAdminProfile } from "./types";

const SEARCH_DEBOUNCE_MS = 500;

export default function DirectoryModerationPage() {
  const profiles = useDirectoryModerationStore((s) => s.profiles);
  const nextCursor = useDirectoryModerationStore((s) => s.nextCursor);
  const search = useDirectoryModerationStore((s) => s.search);
  const loading = useDirectoryModerationStore((s) => s.loading);
  const loadingMore = useDirectoryModerationStore((s) => s.loadingMore);
  const saving = useDirectoryModerationStore((s) => s.saving);
  const setSearch = useDirectoryModerationStore((s) => s.setSearch);
  const fetchProfiles = useDirectoryModerationStore((s) => s.fetchProfiles);
  const fetchMore = useDirectoryModerationStore((s) => s.fetchMore);
  const setModeration = useDirectoryModerationStore((s) => s.setModeration);

  const [searchInput, setSearchInput] = useState(search);
  const isFirstRender = useRef(true);
  // The last card picked stays set after the dialog closes, so its name
  // doesn't blank out during the close animation.
  const [hiding, setHiding] = useState<DirectoryAdminProfile | null>(null);
  const [hideOpen, setHideOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchProfiles(controller.signal);
    return () => controller.abort();
  }, [search, fetchProfiles]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      setSearch(next.length >= 2 ? next : "");
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, setSearch]);

  const handleHide = useCallback((profile: DirectoryAdminProfile) => {
    setHiding(profile);
    setHideOpen(true);
  }, []);

  const handleRestore = useCallback(
    (profile: DirectoryAdminProfile) => {
      void setModeration(profile, false);
    },
    [setModeration],
  );

  const handleConfirmHide = async (reason: string) => {
    if (!hiding) return;
    const ok = await setModeration(hiding, true, reason);
    if (ok) setHideOpen(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Attendee directory</CardTitle>
          <CardDescription>
            Review the cards hackers publish in the Directory. Hiding a card
            removes it from every directory list until you restore it.
          </CardDescription>
          <CardAction>
            <SearchBar value={searchInput} onChange={setSearchInput} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading && profiles.length === 0 ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {search ? "No cards match that search." : "No cards yet."}
            </p>
          ) : (
            <>
              <ModerationTable
                profiles={profiles}
                saving={saving}
                onHide={handleHide}
                onRestore={handleRestore}
              />
              {nextCursor && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => void fetchMore()}
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <HideCardDialog
        profile={hiding}
        open={hideOpen}
        saving={hiding ? Boolean(saving[hiding.user_id]) : false}
        onOpenChange={setHideOpen}
        onConfirm={(reason) => void handleConfirmHide(reason)}
      />
    </>
  );
}
