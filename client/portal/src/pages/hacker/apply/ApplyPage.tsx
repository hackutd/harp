import { useUserStore } from "@/shared/stores";

import { ApplicationWizard } from "./components/ApplicationWizard";

export default function ApplyPage() {
  const { user } = useUserStore();

  return (
    <div className="min-h-svh bg-white">
      <ApplicationWizard userEmail={user?.email} />
    </div>
  );
}
