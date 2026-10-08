import {
  IconBrandInstagram,
  IconLink,
  IconWorld,
  type TablerIcon,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

import {
  type BrandIconProps,
  DevpostIcon,
  DiscordIcon,
  GitHubIcon,
  NotionIcon,
} from "./hacker-link-brand-icons";

export type HackerLinkIconComponent =
  | TablerIcon
  | ComponentType<BrandIconProps>;

export const HACKER_LINK_ICONS: Record<string, HackerLinkIconComponent> = {
  devpost: DevpostIcon,
  discord: DiscordIcon,
  github: GitHubIcon,
  instagram: IconBrandInstagram,
  globe: IconWorld,
  notion: NotionIcon,
  link: IconLink,
};

export const HACKER_LINK_ICON_OPTIONS = [
  { value: "devpost", label: "Devpost" },
  { value: "discord", label: "Discord" },
  { value: "github", label: "GitHub" },
  { value: "instagram", label: "Instagram" },
  { value: "globe", label: "Website" },
  { value: "notion", label: "Notion page" },
  { value: "link", label: "Generic link" },
] as const;

export function hackerLinkIcon(icon: string): HackerLinkIconComponent {
  return HACKER_LINK_ICONS[icon] ?? IconLink;
}
