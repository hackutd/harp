import { useEffect } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { SponsorsTable } from "./components/SponsorsTable";
import { useSponsorsStore } from "./store";

export default function SponsorsPage() {
  const {
    sponsors,
    loading,
    saving,
    fetch: fetchSponsors,
    createSponsor,
    updateSponsor,
    deleteSponsor,
    uploadLogo,
  } = useSponsorsStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchSponsors(controller.signal);
    return () => controller.abort();
  }, [fetchSponsors]);

  if (loading && sponsors.length === 0) {
    return (
      <div className="space-y-6 overflow-auto">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <SponsorsTable
        sponsors={sponsors}
        saving={saving}
        onCreateSponsor={createSponsor}
        onUpdateSponsor={updateSponsor}
        onDeleteSponsor={deleteSponsor}
        onUploadLogo={uploadLogo}
      />
    </div>
  );
}
