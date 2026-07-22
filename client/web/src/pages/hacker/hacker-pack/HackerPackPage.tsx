import { ChevronLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";

import { fetchHackerPackURL } from "./api";

export default function HackerPackPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const openUrl = url.replace(/\/ebd\/+/i, "/");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const res = await fetchHackerPackURL(controller.signal);
      if (controller.signal.aborted) return;
      if (res.status === 200 && res.data) {
        setUrl(res.data.url.trim());
      }
      setLoading(false);
    };
    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="flex h-[calc(100svh-6rem)] flex-col md:h-svh">
      <div className="flex w-full items-center justify-between gap-3 px-3 pt-2 md:px-4 md:pt-3">
        <button
          type="button"
          onClick={() => navigate("/app")}
          aria-label="Back"
          className="-ml-1 flex size-9 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0]"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>
        {url && (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] px-3.5 py-1.5 text-xs font-light text-[#6B6B6B] transition-colors hover:text-black"
          >
            <ExternalLink className="size-3.5" strokeWidth={1.5} />
            Open in Notion
          </a>
        )}
      </div>

      <div className="mt-2 flex w-full flex-1 flex-col px-3 pb-3 md:px-4 md:pb-4">
        {loading ? (
          <Skeleton className="h-full min-h-[60vh] w-full rounded-sm" />
        ) : !url ? (
          <div className="flex flex-1 items-center justify-center rounded-sm border border-[#E5E5E5] bg-[#FAFAFA] px-6 py-16 text-center">
            <p className="text-sm font-light text-[#8A8A8A]">
              The Hacker Pack isn't available yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden rounded-sm border border-[#E5E5E5] bg-[#FAFAFA]">
            <iframe
              src={url}
              title="Hacker Pack"
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        )}
      </div>
    </div>
  );
}
