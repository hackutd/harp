import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { renderLabel } from "@/shared/lib/schema-utils";

import { fetchFAQ } from "./api";
import type { FAQ } from "./types";

export default function FAQPage() {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await fetchFAQ(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setFaqs(
          [...res.data.faqs].sort((a, b) => a.display_order - b.display_order),
        );
      }
      setLoading(false);
    };
    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-5 pt-4 pb-8 md:max-w-5xl md:px-8 md:pt-6">
      <button
        type="button"
        onClick={() => navigate("/app")}
        aria-label="Back"
        className="-ml-2 flex size-9 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0]"
      >
        <ChevronLeft className="size-5" strokeWidth={1.75} />
      </button>

      <h1 className="mt-3 text-2xl font-light tracking-tight text-black">
        FAQ
      </h1>
      <p className="mt-1 text-sm font-light text-[#6B6B6B]">
        Answers to common questions about HackUTD.
      </p>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : faqs.length === 0 ? (
        <p className="pt-12 text-center text-sm font-light text-[#8A8A8A]">
          No FAQs yet. Check back soon.
        </p>
      ) : (
        <Accordion type="single" collapsible className="mt-4">
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.id}
              value={faq.id}
              className="border-[#E5E5E5]"
            >
              <AccordionTrigger className="text-base font-normal text-black hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm font-light whitespace-pre-line text-[#6B6B6B]">
                {renderLabel(faq.answer)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
