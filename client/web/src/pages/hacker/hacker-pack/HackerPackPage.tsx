import { ChevronLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";

import { fetchHackerPackURL } from "./api";

export default function HackerPackPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);

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
      <div className="mx-auto w-full max-w-2xl px-5 pt-4 md:max-w-5xl md:px-8 md:pt-6">
        <button
          type="button"
          onClick={() => navigate("/app")}
          aria-label="Back"
          className="-ml-2 flex size-9 items-center justify-center rounded-full text-black transition-colors hover:bg-[#F0F0F0]"
        >
          <ChevronLeft className="size-5" strokeWidth={1.75} />
        </button>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-black">
              Hacker Pack
            </h1>
            <p className="mt-1 text-sm font-light text-[#6B6B6B]">
              Everything you need to know for HackUTD.
            </p>
          </div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] px-3.5 py-1.5 text-xs font-light text-[#6B6B6B] transition-colors hover:text-black"
            >
              <ExternalLink className="size-3.5" strokeWidth={1.5} />
              Open in Notion
            </a>
          )}
        </div>
      </div>

      <div className="mx-auto mt-4 flex w-full max-w-2xl flex-1 flex-col px-5 pb-5 md:max-w-5xl md:px-8 md:pb-6">
        {loading ? (
          <Skeleton className="h-full min-h-[60vh] w-full rounded-lg" />
        ) : !url ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-6 py-16 text-center">
            <p className="text-sm font-light text-[#8A8A8A]">
              The Hacker Pack isn't available yet. Check back soon.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]">
            <iframe src={url} title="Hacker Pack" className="h-full w-full" />
          </div>
        )}
      </div>
    </div>
  );
}
