import { Loader2, Save } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

import { ApplicationPreview } from "./components/ApplicationPreview";
import { SchemaEditor } from "./components/SchemaEditor";
import { useApplicationSchemaStore } from "./store";

export default function ApplicationPage() {
  const { fields, sections, loading, saving, fetchSchema, saveSchema } =
    useApplicationSchemaStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchSchema(controller.signal);
    return () => controller.abort();
  }, [fetchSchema]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left: Application Preview */}
      <Card className="w-1/2 rounded-r-none overflow-hidden flex flex-col h-full">
        <CardHeader className="shrink-0 border-b px-6 pb-2!">
          <CardDescription className="font-semibold text-slate-900">
            Application Preview
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          <ApplicationPreview fields={fields} sections={sections} />
        </CardContent>
      </Card>

      {/* Right: Schema Editor */}
      <Card className="w-1/2 rounded-l-none border-l-0 overflow-hidden flex flex-col h-full">
        <CardHeader className="shrink-0 border-b px-6 pb-2!">
          <CardDescription className="font-semibold text-slate-900">
            Application Schema
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <SchemaEditor />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={saving} className="w-full cursor-pointer">
                    {saving ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="size-4 mr-2" />
                    )}
                    Save Schema
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Save application schema?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will affect <strong>all</strong> hacker applications.
                      Are you sure you want to save these changes?
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
