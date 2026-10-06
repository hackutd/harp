import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface CopyResponseButtonProps {
  text: string;
  label: string;
}

export function CopyResponseButton({ text, label }: CopyResponseButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-6 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
      aria-label={`Copy ${label}`}
      title={copied ? "Copied" : `Copy ${label}`}
    >
      {copied ? (
        <Check className="size-3.5 text-green-600" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}
