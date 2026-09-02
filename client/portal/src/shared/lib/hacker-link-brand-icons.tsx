import type { SVGProps } from "react";

// Drawn to Lucide's spec (24-unit grid, 2-unit stroke, round caps/joins) so
// they sit next to lucide-react icons at the same optical weight. Callers can
// override strokeWidth exactly like a Lucide icon.
function BrandIcon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function DevpostIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BrandIcon {...props}>
      <path d="M7 3.3h10l5 8.7-5 8.7H7L2 12z" />
      <path d="M8.5 8h3a4 4 0 0 1 0 8h-3z" />
    </BrandIcon>
  );
}

// Outline adapted from Tabler Icons `brand-discord` (MIT).
export function DiscordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BrandIcon {...props}>
      <path d="M8 12a1 1 0 1 0 2 0a1 1 0 0 0-2 0" />
      <path d="M14 12a1 1 0 1 0 2 0a1 1 0 0 0-2 0" />
      <path d="M15.5 17c0 1 1.5 3 2 3c1.5 0 2.833-1.667 3.5-3c.667-1.667.5-5.833-1.5-11.5c-1.457-1.015-3-1.34-4.5-1.5l-.972 1.923a11.913 11.913 0 0 0-4.053 0l-.975-1.923c-1.5.16-3.043.485-4.5 1.5c-2 5.667-2.167 9.833-1.5 11.5c.667 1.333 2 3 3.5 3c.5 0 2-2 2-3" />
      <path d="M7 16.5c3.5 1 6.5 1 10 0" />
    </BrandIcon>
  );
}
