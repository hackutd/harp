// Validators return an error string, or undefined when the value is fine.

export const projectId = (v) =>
  /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(v)
    ? undefined
    : "6–30 characters: lowercase letters, digits, hyphens; start with a letter, no trailing hyphen.";

export const region = (v) =>
  /^[a-z]+-[a-z]+\d+$/.test(v) ? undefined : "Expected a region like us-south1 or us-central1.";

export const serviceName = (v) =>
  /^[a-z]([a-z0-9-]{0,47}[a-z0-9])?$/.test(v)
    ? undefined
    : "Lowercase letters, digits, hyphens; start with a letter; at most 49 characters.";

export const bucketName = (v) => {
  if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(v)) {
    return "3–63 characters: lowercase letters, digits, hyphens, underscores, dots.";
  }
  if (v.startsWith("goog") || v.includes("google")) return 'Bucket names cannot start with "goog" or contain "google".';
  return undefined;
};

export const email = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? undefined : "Expected an email address.");

export const httpsUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.hostname === "localhost" ? undefined : "Expected an https:// URL.";
  } catch {
    return "Expected a URL.";
  }
};

export const postgresUrl = (v) => {
  try {
    const u = new URL(v);
    if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") return "Expected a postgres:// or postgresql:// URL.";
    if (!u.hostname) return "The URL has no host.";
    return undefined;
  } catch {
    return "Expected a postgres:// connection URI (quote-free, paste it exactly as your provider shows it).";
  }
};

export const minLength = (n) => (v) => (v.length >= n ? undefined : `Must be at least ${n} characters.`);

export const githubPart = (v) =>
  /^[A-Za-z0-9_.-]+$/.test(v) ? undefined : "Letters, digits, '.', '_' and '-' only.";

export const port = (v) => (/^\d{1,5}$/.test(v) && Number(v) > 0 && Number(v) < 65536 ? undefined : "Expected a port number.");
