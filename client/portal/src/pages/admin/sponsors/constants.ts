export const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

// Upper bound on the file an admin may pick. Logos are downscaled and
// re-encoded client-side before upload, so this only guards against
// accidentally selecting something enormous.
export const MAX_LOGO_SOURCE_BYTES = 10 * 1024 * 1024;

// Matches maxLogoBytes on the backend (decoded size after compression).
export const MAX_LOGO_BYTES = 1 * 1024 * 1024;
