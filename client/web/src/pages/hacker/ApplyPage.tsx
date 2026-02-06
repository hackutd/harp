import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ApplicationWizard } from "@/pages/hacker/apply/components/ApplicationWizard";
import { useUserStore } from "@/shared/stores";

export default function Apply() {
  const navigate = useNavigate();
  const { user } = useUserStore();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => navigate("/app")}>
              &larr; Back to Dashboard
            </Button>
          </div>

          <ApplicationWizard userEmail={user?.email} />
        </div>
      </div>
    </div>
  );
}
