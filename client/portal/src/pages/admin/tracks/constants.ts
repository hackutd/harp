export const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

// Matches maxTrackLogoBytes on the backend. readJSON caps the request body at
// 1MB and base64 inflates by ~4/3, so a 1MB decoded limit is unreachable.
export const MAX_LOGO_BYTES = 750 * 1024;
