import { useEffect } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { TracksTable } from "./components/TracksTable";
import { useTracksStore } from "./store";

export default function TracksPage() {
  const {
    tracks,
    canEdit,
    loading,
    saving,
    fetch: loadTracks,
    createTrack,
    updateTrack,
    deleteTrack,
    uploadLogo,
  } = useTracksStore();

  useEffect(() => {
    const controller = new AbortController();
    loadTracks(controller.signal);
    return () => controller.abort();
  }, [loadTracks]);

  if (loading && tracks.length === 0) {
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
      <TracksTable
        tracks={tracks}
        saving={saving}
        canEdit={canEdit}
        onCreateTrack={createTrack}
        onUpdateTrack={updateTrack}
        onDeleteTrack={deleteTrack}
        onUploadLogo={uploadLogo}
      />
    </div>
  );
}
