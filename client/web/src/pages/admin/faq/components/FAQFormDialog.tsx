import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { FAQ, FAQPayload } from "../types";

interface FAQFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faq: FAQ | null;
  saving: boolean;
  onSubmit: (payload: FAQPayload) => void;
}

function FAQForm({
  faq,
  saving,
  onSubmit,
  onCancel,
}: {
  faq: FAQ | null;
  saving: boolean;
  onSubmit: (payload: FAQPayload) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [displayOrder, setDisplayOrder] = useState(faq?.display_order ?? 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;

    onSubmit({
      question: question.trim(),
      answer: answer.trim(),
      display_order: displayOrder,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="faq-question">Question</Label>
        <Input
          id="faq-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What time does check-in open?"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="faq-answer">Answer</Label>
        <Textarea
          id="faq-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Check-in opens at 9am. See the [schedule](https://hackutd.co) for details."
          rows={5}
          required
        />
        <p className="text-xs text-muted-foreground">
          Line breaks are preserved. Use [text](https://url) to add links.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="faq-order">Display Order</Label>
        <Input
          id="faq-order"
          type="number"
          min={0}
          value={displayOrder}
          onChange={(e) => setDisplayOrder(Number(e.target.value))}
        />
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !question.trim() || !answer.trim()}
          className="cursor-pointer"
        >
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          {faq ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FAQFormDialog({
  open,
  onOpenChange,
  faq,
  saving,
  onSubmit,
}: FAQFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{faq ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
        </DialogHeader>
        {open && (
          <FAQForm
            key={faq?.id ?? "new"}
            faq={faq}
            saving={saving}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
