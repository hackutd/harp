import type { IconProps } from "@tabler/icons-react";
import { forwardRef, useId } from "react";

// The front person reuses IconUserFilled's head and body, shifted left.
const FRONT_HEAD = "M9 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z";
const FRONT_BODY =
  "M11 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z";

/**
 * Filled counterpart to Tabler's IconUsers, which Tabler doesn't ship. The
 * person behind is masked out around the front one, leaving the same 1px gap
 * the outline version's overlap reads as.
 */
export const IconUsersFilled = forwardRef<SVGSVGElement, IconProps>(
  function IconUsersFilled(
    {
      color = "currentColor",
      size = 24,
      stroke: _stroke,
      title,
      className,
      children,
      ...rest
    },
    ref,
  ) {
    const maskId = useId();
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color}
        className={["tabler-icon", "tabler-icon-users-filled", className]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {title && <title>{title}</title>}
        <mask id={maskId}>
          <rect width="24" height="24" fill="white" />
          <g fill="black" stroke="black" strokeWidth="2">
            <path d={FRONT_HEAD} />
            <path d={FRONT_BODY} />
          </g>
        </mask>
        <g mask={`url(#${maskId})`}>
          <circle cx="16" cy="7" r="4" />
          <path d="M12 14h6a4 4 0 0 1 4 4v2a2 2 0 0 1 -2 2h-8z" />
        </g>
        <path d={FRONT_HEAD} />
        <path d={FRONT_BODY} />
        {children}
      </svg>
    );
  },
);
