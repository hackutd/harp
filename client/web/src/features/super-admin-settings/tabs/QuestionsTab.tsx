import * as React from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { ShortAnswerQuestion } from "../../../types"

interface QuestionsTabProps {
  questions: ShortAnswerQuestion[]
  setQuestions: React.Dispatch<React.SetStateAction<ShortAnswerQuestion[]>>
  loading: boolean
}

export function QuestionsTab({ questions, setQuestions, loading }: QuestionsTabProps) {
  const updateQuestion = (index: number, field: keyof ShortAnswerQuestion, value: string | boolean | number) => {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q))
  }

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: `saq_${Date.now()}`,
        question: "",
        required: false,
        display_order: prev.length + 1,
      },
    ])
  }

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg text-zinc-100">Short Answer Questions</h3>
      <p className="text-sm text-zinc-400">
        Configure the short answer questions that appear on hacker applications.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="space-y-3 pt-2">
          {questions.map((q, index) => (
            <div
              key={q.id}
              className="bg-zinc-900 rounded-md p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs text-zinc-500 pt-1 shrink-0">
                  Q{index + 1}
                </span>
                <Textarea
                  value={q.question}
                  onChange={(e) => updateQuestion(index, "question", e.target.value)}
                  placeholder="Enter question text..."
                  className="flex-1 min-h-[30px] bg-zinc-800 border-0 rounded-sm text-zinc-100 placeholder:text-zinc-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`required-${q.id}`}
                    checked={q.required}
                    onCheckedChange={(checked) => updateQuestion(index, "required", checked === true)}
                    className="border-zinc-500 cursor-pointer data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900 data-[state=checked]:border-zinc-100"
                  />
                  <Label htmlFor={`required-${q.id}`} className="text-sm text-zinc-300 cursor-pointer">
                    Required
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuestion(index)}
                  className="text-zinc-500 hover:text-red-400 hover:bg-transparent cursor-pointer h-8 w-8 p-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addQuestion}
            className="w-full border-dashed border-zinc-700 bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 cursor-pointer"
          >
            <Plus className="size-4 mr-2" />
            Add Question
          </Button>
        </div>
      )}
    </div>
  )
}
