import { useUserStore } from "@/shared/stores";

import { HackerQR } from "../components/HackerQR";

export default function ScanPage() {
  const { user } = useUserStore();

  return (
    <div className="mx-auto flex min-h-[70svh] max-w-2xl flex-col items-center justify-center px-5 md:px-10">
      <h1 className="text-2xl font-light tracking-tight text-black">
        Your code
      </h1>
      <p className="mt-1 text-center text-sm font-light text-[#8A8A8A]">
        Show this at check-in, meals, and events
      </p>

      {user?.id ? (
        <div className="mt-8 rounded-xl border border-[#E5E5E5] p-4 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
          <HackerQR value={user.id} size={240} />
        </div>
      ) : (
        <p className="mt-8 text-sm font-light text-[#8A8A8A]">
          Sign in to view your code.
        </p>
      )}

      {user?.email && (
        <p className="mt-6 text-xs font-light text-[#8A8A8A]">{user.email}</p>
      )}
    </div>
  );
}
