import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorAlert } from "@/shared/lib/api";

import { fetchFormsOverview } from "./api";
import { FormDetail } from "./components/FormDetail";
import { FormsOverview } from "./components/FormsOverview";
import type { FormKey, FormsOverviewData } from "./types";

const validForms = new Set<FormKey>(["application", "rsvp", "travel"]);

export default function FormsPage() {
  const { formKey } = useParams();
  const form = formKey as FormKey | undefined;
  const [data, setData] = useState<FormsOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    const result = await fetchFormsOverview();
    if (result.status === 200 && result.data) {
      setData(result.data);
    } else {
      errorAlert(result);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchFormsOverview(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.status === 200 && result.data) {
        setData(result.data);
      } else {
        errorAlert(result);
      }
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  if (form && !validForms.has(form)) {
    return <Navigate to="/admin/sa/forms" replace />;
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 xl:grid-cols-3">
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-medium">Forms overview could not be loaded.</p>
        <Button variant="outline" onClick={() => load()}>
          Try again
        </Button>
      </div>
    );
  }

  if (form) {
    return <FormDetail form={form} data={data} onRefresh={() => load(true)} />;
  }

  return (
    <div className="space-y-5">
      <FormsOverview
        data={data}
        refreshing={refreshing}
        onRefresh={() => load(true)}
      />
    </div>
  );
}
