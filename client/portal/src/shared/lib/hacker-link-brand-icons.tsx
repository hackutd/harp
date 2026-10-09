import type { CSSProperties } from "react";

import googleSrc from "@/assets/google_icon.webp";
import devpostSrc from "@/assets/icons/devpost.svg";
import discordSrc from "@/assets/icons/discord.svg";
import githubSrc from "@/assets/icons/github.svg";
import linkedinSrc from "@/assets/icons/linkedin.svg";
import notionSrc from "@/assets/icons/notion.svg";

import { cn } from "./utils";

// Accepts the same props callers pass to Tabler icons. strokeWidth is ignored
// because the brand marks are filled shapes.
export interface BrandIconProps {
  className?: string;
  strokeWidth?: number | string;
}

// The asset SVGs are single-color marks, so they're painted as a CSS mask over
// currentColor. That keeps them tinting with the surrounding text the way a
// Tabler icon does, which an <img> can't.
function maskIcon(src: string) {
  const style: CSSProperties = {
    maskImage: `url("${src}")`,
    WebkitMaskImage: `url("${src}")`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };
  return function MaskIcon({ className }: BrandIconProps) {
    return (
      <span
        aria-hidden="true"
        className={cn("block size-6 shrink-0 bg-current", className)}
        style={style}
      />
    );
  };
}

export const DevpostIcon = maskIcon(devpostSrc);
export const DiscordIcon = maskIcon(discordSrc);
export const NotionIcon = maskIcon(notionSrc);
export const GitHubIcon = maskIcon(githubSrc);
export const LinkedInIcon = maskIcon(linkedinSrc);

// The full-color "G" from the Google sign-in button, for "this came from your
// Google account" labels. Unlike the marks above it keeps Google's colors.
export function GoogleIcon({ className }: BrandIconProps) {
  return (
    <img
      src={googleSrc}
      alt=""
      aria-hidden="true"
      className={cn("block size-6 shrink-0", className)}
    />
  );
}
