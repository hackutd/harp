import { useEffect } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { FAQTable } from "./components/FAQTable";
import { useFAQStore } from "./store";

export default function FAQPage() {
  const {
    faqs,
    canEdit,
    loading,
    saving,
    fetch: loadFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ,
  } = useFAQStore();

  useEffect(() => {
    const controller = new AbortController();
    loadFAQs(controller.signal);
    return () => controller.abort();
  }, [loadFAQs]);

  if (loading && faqs.length === 0) {
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
      <FAQTable
        faqs={faqs}
        saving={saving}
        canEdit={canEdit}
        onCreateFAQ={createFAQ}
        onUpdateFAQ={updateFAQ}
        onDeleteFAQ={deleteFAQ}
      />
    </div>
  );
}
