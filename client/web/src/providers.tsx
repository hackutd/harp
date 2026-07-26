import { SuperTokensWrapper } from "supertokens-auth-react";

import { InstallPromptHost } from "@/components/InstallPromptHost";
import { PushPromptHost } from "@/components/PushPromptHost";
import { Toaster } from "@/components/ui/sonner";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SuperTokensWrapper>
      {children}
      <Toaster />
      <InstallPromptHost />
      <PushPromptHost />
    </SuperTokensWrapper>
  );
}
