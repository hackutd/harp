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

// Matches maxTrackLogoBytes on the backend (decoded size after compression).
// readJSON caps the request body at 1MB and base64 inflates by ~4/3, so a 1MB
// decoded limit is unreachable.
export const MAX_LOGO_BYTES = 750 * 1024;
