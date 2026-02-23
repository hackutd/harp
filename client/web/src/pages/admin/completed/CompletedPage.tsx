import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { errorAlert, getRequest } from "@/shared/lib/api";
import type { Application } from "@/types";

import { ApplicationDetailsPanel } from "../assigned/components/ApplicationDetailsPanel";
import { VoteBadge } from "../assigned/components/VoteBadge";
import { CompletedReviewsTable } from "./components/CompletedReviewsTable";
import { useCompletedReviewsStore } from "./store";
import type { NotesListResponse, ReviewNote } from "./types";

function formatName(firstName: string | null, lastName: string | null) {
  if (!firstName && !lastName) return "-";
  return `${firstName ?? ""} ${lastName ?? ""}`.trim();
}

export default function CompletedPage() {
  const { reviews, loading, fetchCompletedReviews } =
    useCompletedReviewsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applicationDetail, setApplicationDetail] =
    useState<Application | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [otherReviewerNotes, setOtherReviewerNotes] = useState<ReviewNote[]>(
    [],
  );
  const [_notesLoading, setNotesLoading] = useState(false);

  const selectReview = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) {
      setApplicationDetail(null);
      setOtherReviewerNotes([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCompletedReviews(controller.signal);
    return () => controller.abort();
  }, [fetchCompletedReviews]);

  // Fetch full application and other reviewers' notes when a review is selected
  useEffect(() => {
    if (!selectedId) return;

    const selectedReview = reviews.find((r) => r.id === selectedId);
    if (!selectedReview) return;

    const controller = new AbortController();

    (async () => {
      setDetailLoading(true);
      setNotesLoading(true);

      const [appRes, notesRes] = await Promise.all([
        getRequest<Application>(
          `/admin/applications/${selectedReview.application_id}`,
          "application",
          controller.signal,
        ),
        getRequest<NotesListResponse>(
          `/admin/applications/${selectedReview.application_id}/notes`,
          "notes",
          controller.signal,
        ),
      ]);

      if (controller.signal.aborted) return;

      if (appRes.status === 200 && appRes.data) {
        setApplicationDetail(appRes.data);
      } else {
        errorAlert(appRes);
      }

      if (notesRes.status === 200 && notesRes.data) {
        setOtherReviewerNotes(notesRes.data.notes);
      }

      setDetailLoading(false);
      setNotesLoading(false);
    })();

    return () => {
      controller.abort();
    };
  }, [selectedId, reviews]);

  const selectedReview = reviews.find((r) => r.id === selectedId) ?? null;

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const currentIndex = reviews.findIndex((r) => r.id === selectedId);
        const nextIndex = currentIndex + 1;
        if (nextIndex < reviews.length) {
          selectReview(reviews[nextIndex].id);
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const currentIndex = reviews.findIndex((r) => r.id === selectedId);
        const prevIndex = currentIndex - 1;
        if (prevIndex >= 0) {
          selectReview(reviews[prevIndex].id);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, reviews, selectReview]);

  if (loading && reviews.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden">
      <div className="flex h-full">
        {/* Left: Table */}
        <Card
          className={`overflow-hidden flex flex-col h-full ${
            selectedId ? "w-1/2 rounded-r-none" : "w-full"
          }`}
        >
          <CardHeader className="shrink-0">
            <CardDescription className="font-light">
              {reviews.length} completed review(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <CompletedReviewsTable
              reviews={reviews}
              selectedId={selectedId}
              loading={loading}
              onSelectReview={selectReview}
            />
          </CardContent>
        </Card>

        {/* Right: Detail Panel */}
        {selectedId && selectedReview && (
          <Card className="shrink-0 flex flex-col h-full w-1/2 rounded-l-none border-l-0 py-0! gap-0!">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 bg-gray-50 border-b px-4 py-3 rounded-tr-xl">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">
                  {formatName(
                    selectedReview.first_name,
                    selectedReview.last_name,
                  )}
                </p>
                <VoteBadge vote={selectedReview.vote} />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                onClick={() => selectReview(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Application details */}
            <CardContent className="flex-1 overflow-auto py-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                applicationDetail && (
                  <>
                    <ApplicationDetailsPanel
                      application={applicationDetail}
                      selectedReview={selectedReview}
                      isExpanded={false}
                    />

                    {/* Reviewer notes section */}
                    {otherReviewerNotes.length > 0 && (
                      <div className="mt-6 border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3">
                          Reviewer Notes
                        </h4>
                        <div className="space-y-3">
                          {otherReviewerNotes.map((note, i) => (
                            <div key={i} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {note.admin_email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(
                                    note.created_at,
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm">{note.notes}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
