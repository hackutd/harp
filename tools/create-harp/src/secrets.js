import { createECDH, randomBytes } from "node:crypto";

// Same format as `task gen-vapid` (webpush-go): base64url without padding,
// uncompressed 65-byte P-256 public key and 32-byte private scalar.
export function generateVapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const priv = ecdh.getPrivateKey();
  const padded = Buffer.concat([Buffer.alloc(Math.max(0, 32 - priv.length)), priv]);
  return {
    publicKey: ecdh.getPublicKey(null, "uncompressed").toString("base64url"),
    privateKey: padded.toString("base64url"),
  };
}

export function randomSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

// Names of every value that must never be printed or written to a
// persistent file. Each can be supplied non-interactively via HARP_<NAME>.
export const SECRET_KEYS = [
  "DB_ADDR",
  "SUPERTOKENS_API_KEY",
  "SENDGRID_API_KEY",
  "EMAIL_PASSWORD",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_BASIC_PASS",
  "PUBLIC_API_KEY",
  "VAPID_PRIVATE_KEY",
];

export function secretsFromEnv() {
  const out = {};
  for (const key of SECRET_KEYS) {
    const v = process.env[`HARP_${key}`];
    if (v) out[key] = v;
  }
  return out;
}
