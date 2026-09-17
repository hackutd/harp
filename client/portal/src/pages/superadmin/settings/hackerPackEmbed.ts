// Shared between the Settings → Hacker Pack tab and the Hacker Links page so
// both surfaces accept and round-trip the exact same Notion embed snippet.

export const HACKER_PACK_EMBED_PLACEHOLDER = `<iframe src="https://your-workspace.notion.site/ebd/..." width="100%" height="600" frameborder="0" allowfullscreen />`;

export const HACKER_PACK_EMBED_HELP =
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
