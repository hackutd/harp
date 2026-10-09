import { Skeleton } from "@/components/ui/skeleton";
import { themeClass, useTheme } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";

interface PageLoaderProps {
  /**
   * Render as a whole admin page, sidebar included, on the user's theme. Used
   * for the lazy AdminLayout import: coming from the hacker portal, its layout
   * has already unmounted and taken the theme class off <body>, so without
   * its own canvas the loader flashes on a white page.
   */
  fullscreen?: boolean;
}

export function PageLoader({ fullscreen = false }: PageLoaderProps) {
  const theme = useTheme();

  const content = (
    <div className="flex-1 h-full p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );

  if (!fullscreen) return content;

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        themeClass(theme),
        "flex min-h-svh bg-background text-foreground",
      )}
    >
      <div className="hidden w-56 space-y-4 border-r p-4 md:block">
        <Skeleton className="h-8 w-32" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      {content}
    </div>
  );
}
