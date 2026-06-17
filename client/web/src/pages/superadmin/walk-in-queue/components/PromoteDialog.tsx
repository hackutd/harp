import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";

import { promoteWalkIns } from "../api";

const schema = z.object({
  count: z.number().int().min(1, "Must promote at least 1"),
});

type FormValues = z.infer<typeof schema>;

interface PromoteDialogProps {
  pending: number;
  onSuccess: () => void;
}

export function PromoteDialog({ pending, onSuccess }: PromoteDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { count: Math.min(pending, 20) || 1 },
  });

  async function onSubmit(values: FormValues) {
    const res = await promoteWalkIns(values.count);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Failed to promote walk-ins");
      return;
    }
    toast.success(
      `Promoted ${res.data.promoted_count} walk-in${res.data.promoted_count !== 1 ? "s" : ""} and sent acceptance emails`,
    );
    setOpen(false);
    form.reset({ count: 1 });
    onSuccess();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset({ count: Math.min(pending, 20) || 1 });
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={pending === 0}>Promote next walk-ins</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote walk-ins</DialogTitle>
          <DialogDescription>
            Promote the next N people in the queue to accepted and send them
            acceptance emails with their QR codes.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number to promote</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Promote &amp; send emails
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
