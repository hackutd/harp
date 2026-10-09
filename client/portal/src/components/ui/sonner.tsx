import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useTheme } from "@/shared/hooks/use-theme";

const Toaster = ({ ...props }: ToasterProps) => {
  // Colours come from the body theme class through the CSS variables below;
  // this only keeps sonner's own chrome (close button, icons) in step.
  const theme = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <IconCircleCheck className="size-4" />,
        info: <IconInfoCircle className="size-4" />,
        warning: <IconAlertTriangle className="size-4" />,
        error: <IconAlertOctagon className="size-4" />,
        loading: (
          <span className="size-3 animate-pulse rounded-full bg-current" />
        ),
      }}
      // On mobile the hacker layout renders a floating bottom nav bar, so lift
      // toasts above it. Desktop keeps sonner's default offset.
      mobileOffset={{
        bottom: "calc(6.5rem + env(safe-area-inset-bottom))",
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          description: "!text-popover-foreground/90",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
