import { useSearchParams } from "react-router";

import { cn } from "@/shared/lib/utils";
import { useUserStore } from "@/shared/stores";

import { MyCodeView } from "./components/MyCodeView";
import { ScannerView } from "./components/ScannerView";

type ScanTab = "code" | "scanner";

const TABS: { value: ScanTab; label: string }[] = [
  { value: "code", label: "My Code" },
  { value: "scanner", label: "Scanner" },
];

// Uniform inset (rem) around the sliding pill — matches the track's padding
// (p-1) and the pill's inset-y, mirroring the bottom nav in HackerLayout.
const TAB_PAD = 0.25;

export default function ScanPage() {
  const { user } = useUserStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const tab: ScanTab =
    isAdmin && searchParams.get("tab") === "scanner" ? "scanner" : "code";
  const activeIndex = TABS.findIndex((t) => t.value === tab);

  const handleTabChange = (next: ScanTab) => {
    setSearchParams(next === "scanner" ? { tab: "scanner" } : {}, {
      replace: true,
    });
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 md:px-10">
        <MyCodeView className="min-h-[70svh]" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-10">
      {/* Admins toggle between their own QR code and the mobile scanner */}
      <div className="relative mx-auto flex w-full max-w-xs rounded-full bg-[#F0F0F0] p-1">
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out"
          style={{
            top: `${TAB_PAD}rem`,
            bottom: `${TAB_PAD}rem`,
            left: `calc(${TAB_PAD}rem + ${activeIndex} * (100% - ${2 * TAB_PAD}rem) / ${TABS.length})`,
            width: `calc((100% - ${2 * TAB_PAD}rem) / ${TABS.length})`,
          }}
        />
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleTabChange(value)}
            aria-pressed={tab === value}
            className={cn(
              "relative z-10 flex-1 rounded-full py-2 text-sm transition-colors active:scale-[0.98]",
              tab === value
                ? "font-medium text-black"
                : "font-light text-[#8A8A8A]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "scanner" ? (
          <ScannerView />
        ) : (
          <MyCodeView className="min-h-[65svh]" />
        )}
      </div>
    </div>
  );
}
