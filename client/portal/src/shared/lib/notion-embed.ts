// Notion pages are stored as the `src` of Notion's "Embed this page" iframe
// snippet. The super-admin editor round-trips the full snippet; the hacker
// page embeds the src and links out to the published page.

export const NOTION_EMBED_PLACEHOLDER = `<iframe src="https://your-workspace.notion.site/ebd/..." width="100%" height="600" frameborder="0" allowfullscreen />`;

export const NOTION_EMBED_HELP =
  'Paste the full <iframe ... /> embed code copied from Notion\'s "Embed this page" option.';

export function toEmbedCode(url: string): string {
  if (!url) return "";
  return `<iframe src="${url}" width="100%" height="600" frameborder="0" allowfullscreen />`;
}

export function extractEmbedURL(value: string): string | null {
  const match = value.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (!match) return null;
  const src = match[1].trim();
  if (!/^https?:\/\//i.test(src)) return null;
  return src;
}

// The embed src lives under /ebd/; the same path without it is the
// published page itself.
export function notionOpenURL(embedURL: string): string {
  return embedURL.replace(/\/ebd\/+/i, "/");
}
