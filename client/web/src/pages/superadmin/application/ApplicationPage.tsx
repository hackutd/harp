import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorAlert, getRequest, putRequest } from "@/shared/lib/api";
import type { ShortAnswerQuestion } from "@/types";

import { ApplicationPreview } from "./components/ApplicationPreview";

export default function ApplicationPage() {
  const [questions, setQuestions] = useState<ShortAnswerQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionsRef = useRef(questions);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    const fetchQuestions = async () => {
      setLoading(true);
      const res = await getRequest<{ questions: ShortAnswerQuestion[] }>(
        "/superadmin/settings/saquestions",
        "short answer questions",
      );
      if (res.status === 200 && res.data) {
        setQuestions(res.data.questions ?? []);
      } else {
        errorAlert(res);
      }
      setLoading(false);
    };
    fetchQuestions();
  }, []);

  const saveQuestions = useCallback(async (qs: ShortAnswerQuestion[]) => {
    const emptyQuestion = qs.find((q) => !q.question.trim());
    if (emptyQuestion) return;

    const payload = qs.map((q, i) => ({ ...q, display_order: i + 1 }));
    const res = await putRequest<{ questions: ShortAnswerQuestion[] }>(
      "/superadmin/settings/saquestions",
      { questions: payload },
      "short answer questions",
    );
    if (res.status === 200 && res.data) {
      toast.success("Questions saved");
    } else {
      errorAlert(res);
    }
  }, []);

  const debouncedSave = useCallback(
    (qs: ShortAnswerQuestion[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveQuestions(qs), 1000);
    },
    [saveQuestions],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateQuestions = useCallback(
    (updater: (prev: ShortAnswerQuestion[]) => ShortAnswerQuestion[]) => {
      setQuestions((prev) => {
        const next = updater(prev);
        debouncedSave(next);
        return next;
      });
    },
    [debouncedSave],
  );

  const updateQuestion = (
    index: number,
    field: keyof ShortAnswerQuestion,
    value: string | boolean | number,
  ) => {
    updateQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
    );
  };

  const addQuestion = () => {
    updateQuestions((prev) => [
      ...prev,
      {
        id: `saq_${Date.now()}`,
        question: "",
        required: false,
        display_order: prev.length + 1,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    updateQuestions((prev) => prev.filter((_, i) => i !== index));
  };

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
          <ApplicationPreview questions={questions} />
        </CardContent>
      </Card>

      {/* Right: SAQ Editor */}
      <Card className="w-1/2 rounded-l-none border-l-0 overflow-hidden flex flex-col h-full">
        <CardHeader className="shrink-0 border-b px-6 pb-2!">
          <CardDescription className="font-semibold text-slate-900">
            Short Answer Questions
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            <p className="text-sm font-light text-muted-foreground">
              Configure the short answer questions that appear on hacker
              applications.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {questions.map((q, index) => (
                  <div key={q.id} className="rounded-md border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs text-muted-foreground pt-1 shrink-0">
                        Q{index + 1}
                      </span>
                      <Textarea
                        value={q.question}
                        onChange={(e) =>
                          updateQuestion(index, "question", e.target.value)
                        }
                        placeholder="Enter question text..."
                        className="flex-1 min-h-[30px] resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`required-${q.id}`}
                          checked={q.required}
                          onCheckedChange={(checked) =>
                            updateQuestion(index, "required", checked === true)
                          }
                          className="cursor-pointer"
                        />
                        <Label
                          htmlFor={`required-${q.id}`}
                          className="text-sm cursor-pointer"
                        >
                          Required
                        </Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(index)}
                        className="text-muted-foreground hover:text-red-500 cursor-pointer h-8 w-8 p-0"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addQuestion}
                  className="w-full border-dashed cursor-pointer"
                >
                  <Plus className="size-4 mr-2" />
                  Add Question
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
