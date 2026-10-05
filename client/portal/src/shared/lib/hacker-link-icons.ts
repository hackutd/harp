import type { LucideIcon } from "lucide-react";
import { Github, Globe, Instagram, Link2 } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { DevpostIcon, DiscordIcon } from "./hacker-link-brand-icons";

export type HackerLinkIconComponent =
  | LucideIcon
  | ComponentType<SVGProps<SVGSVGElement>>;

export const HACKER_LINK_ICONS: Record<string, HackerLinkIconComponent> = {
  devpost: DevpostIcon,
  discord: DiscordIcon,
  github: Github,
  instagram: Instagram,
  globe: Globe,
  link: Link2,
};

export const HACKER_LINK_ICON_OPTIONS = [
  { value: "devpost", label: "Devpost" },
  { value: "discord", label: "Discord" },
  { value: "github", label: "GitHub" },
  { value: "instagram", label: "Instagram" },
  { value: "globe", label: "Website" },
  { value: "link", label: "Generic link" },
] as const;

export function hackerLinkIcon(icon: string): HackerLinkIconComponent {
  return HACKER_LINK_ICONS[icon] ?? Link2;
}
