import { RotateCcw, Save } from "lucide-react";
import { useEffect } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { ApplicationPreview } from "../application/components/ApplicationPreview";
import { SchemaEditor } from "../application/components/SchemaEditor";
import { useRSVPSchemaStore } from "./store";

export default function RSVPPage() {
  const {
    fields,
    sections,
    loading,
    saving,
    dirty,
    fetchSchema,
    saveSchema,
    discardChanges,
  } = useRSVPSchemaStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchSchema(controller.signal);
    return () => controller.abort();
  }, [fetchSchema]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: RSVP Form Preview */}
      <Card className="w-1/2 rounded-r-none overflow-hidden flex flex-col h-full">
        <CardHeader className="shrink-0 border-b px-6 pb-2!">
          <CardDescription className="font-semibold text-slate-900">
            RSVP Form Preview
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <ApplicationPreview
            fields={fields}
            sections={sections}
            systemBlock="rsvp_decision"
          />
        </CardContent>
      </Card>

      {/* Right: Schema Editor */}
      <Card className="w-1/2 rounded-l-none border-l-0 overflow-hidden flex flex-col h-full">
        <CardHeader className="shrink-0 border-b px-6 pb-2!">
          <CardDescription className="font-semibold text-slate-900">
            RSVP Schema
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="space-y-3 py-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <SchemaEditor
                store={useRSVPSchemaStore}
                description="Configure the fields accepted hackers fill out when claiming their spot. Fields are grouped by section. Whether RSVPs are open is controlled from Settings → Permissions."
              />

              <div className="sticky bottom-0 flex items-center gap-2 border-t bg-background pt-3">
                <Button
                  variant="outline"
                  disabled={!dirty || saving}
                  onClick={discardChanges}
                >
                  <RotateCcw className="size-4" />
                  Discard
                </Button>
                {dirty && <Badge variant="secondary">Unsaved changes</Badge>}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      loading={saving}
                      disabled={!dirty}
                      className="ml-auto cursor-pointer"
                    >
                      {!saving && <Save className="size-4 mr-2" />}
                      Save Schema
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Save RSVP schema?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will affect <strong>all</strong> RSVP forms for
                        accepted hackers. Are you sure you want to save these
                        changes?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="cursor-pointer">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={saveSchema}
                        className="cursor-pointer bg-red-600 hover:bg-red-700"
                      >
                        Save
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
