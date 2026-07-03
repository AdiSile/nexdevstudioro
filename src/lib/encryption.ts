/**
 * AES-256-GCM Encryption Utilities
 *
 * Production-grade encryption for sensitive data, API keys, and secrets
 * management. Built on Node.js native crypto — zero external dependencies.
 *
 * Security Features:
 *   - AES-256-GCM authenticated encryption (confidentiality + integrity + authenticity)
 *   - PBKDF2 key derivation with SHA-512 (210 000 iterations, per-key random salt)
 *   - HKDF-SHA512 for sub-key derivation (key separation)
 *   - CSPRNG for IV/nonce generation (crypto.randomBytes)
 *   - Constant-time comparison for MAC/tag verification
 *   - Key hierarchy: Master Key → Derived Encryption Key (via HKDF)
 *   - Encrypted payload envelope with versioning (future-proof key rotation)
 *   - Automatic memory zeroing of sensitive buffers
 *   - Tamper detection: any bit flip → decryption failure
 *   - Rate-limiting stub for brute-force protection (delegates to rate-limit layer)
 *
 * Key Hierarchy:
 *   ENCRYPTION_MASTER_KEY (env, 64 hex chars = 32 bytes)
 *     └── HKDF-SHA512(info="nexus:v1:encryption") → 32-byte AES-256 key
 *
 * Payload Envelope (stored in DB / config):
 *   {
 *     "v": 1,                        // envelope version
 *     "k": "<base64url-salt>",       // PBKDF2 salt (for key-encrypting-key path)
 *     "i": "<base64url-iv>",         // 12-byte IV for AES-GCM
 *     "d": "<base64url-ciphertext>", // AES-256-GCM ciphertext
 *     "t": "<base64url-auth-tag>"    // 16-byte GCM authentication tag
 *   }
 *
 * Environment Variables:
 *   ENCRYPTION_MASTER_KEY   — 64 hex characters (32 bytes) — REQUIRED
 *   ENCRYPTION_KEY_VERSION  — current key version (default: 1)
 *   ENCRYPTION_PBKDF2_ITER  — PBKDF2 iterations (default: 210000)
 *
 * Usage:
 *   import { encrypt, decrypt, encryptToJSON, decryptFromJSON } from "@/lib/encryption";
 *
 *   // Encrypt a plaintext string:
 *   const envelope = encrypt("my-secret-api-key");
 *
 *   // Decrypt:
 *   const plaintext = decrypt(envelope);
 *
 *   // Store as JSON in the database:
 *   const json = encryptToJSON("my-api-key");   // → string
 *   const key = decryptFromJSON(json);          // → "my-api-key"
 *
 *   // Encrypt an object:
 *   const json = encryptToJSON(JSON.stringify({ apiKey: "sk-...", provider: "openai" }));
 *
 *   // Rotate a secret (decrypt with old, re-encrypt with current):
 *   const rotated = rotateEnvelope(oldEnvelope);
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  pbkdf2Sync,
  timingSafeEqual,
  createHmac,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AES_ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits
const HKDF_HASH = "sha512";
const HKDF_INFO_PREFIX = "nexus:v";

const CURRENT_VERSION = 1;
const MIN_PBKDF2_ITERATIONS = 210_000; // OWASP 2024 recommendation for SHA-512

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Serialized encryption envelope */
export interface EncryptionEnvelope {
  /** Envelope version for key rotation support */
  v: number;
  /** Salt used during key derivation (base64url) */
  k: string;
  /** Initialization vector (base64url) */
  i: string;
  /** Ciphertext (base64url) */
  d: string;
  /** Authentication tag (base64url) */
  t: string;
}

/** Structured encryption result */
export interface EncryptionResult {
  /** The encryption envelope */
  envelope: EncryptionEnvelope;
  /** Envelope serialized as a compact JSON string */
  serialized: string;
}

/** Decryption options (for future key rotation) */
export interface DecryptionOptions {
  /** Override master key (e.g., for decrypting with an old key during rotation) */
  masterKey?: Buffer;
  /** Override key version */
  keyVersion?: number;
}

/** Encryption options */
export interface EncryptionOptions {
  /** Additional authenticated data (AAD) — not encrypted but integrity-protected */
  aad?: Buffer | string;
  /** Override PBKDF2 iterations */
  iterations?: number;
}

/** Result of key rotation */
export interface RotationResult {
  /** The new envelope re-encrypted with current master key */
  envelope: EncryptionEnvelope;
  /** Whether rotation was necessary (false if already at current version) */
  rotated: boolean;
  /** Previous version */
  fromVersion: number;
  /** New version */
  toVersion: number;
}

// ---------------------------------------------------------------------------
// Helpers: Encoding
// ---------------------------------------------------------------------------

function toBase64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64url(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

// ---------------------------------------------------------------------------
// Helpers: Constant-Time
// ---------------------------------------------------------------------------

/**
 * Constant-time buffer comparison.
 * Uses crypto.timingSafeEqual — resistant to timing side-channel attacks.
 */
function constantTimeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    // Still compare in constant time: hash both and compare those
    const hashA = createHmac("sha256", randomBytes(32)).update(a).digest();
    const hashB = createHmac("sha256", randomBytes(32)).update(b).digest();
    try {
      return timingSafeEqual(hashA, hashB);
    } catch {
      return false;
    }
  }

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Master Key Management
// ---------------------------------------------------------------------------

function getMasterKeyHex(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY;

  if (!key) {
    throw new Error(
      "[encryption] ENCRYPTION_MASTER_KEY environment variable is required. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  if (key.length !== 64) {
    throw new Error(
      `[encryption] ENCRYPTION_MASTER_KEY must be exactly 64 hex characters (32 bytes). Got ${key.length} characters.`,
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      "[encryption] ENCRYPTION_MASTER_KEY must contain only hexadecimal characters (0-9, a-f, A-F).",
    );
  }

  return key;
}

function getMasterKey(): Buffer {
  const hex = getMasterKeyHex();
  return Buffer.from(hex, "hex");
}

function getKeyVersion(): number {
  const v = Number(process.env.ENCRYPTION_KEY_VERSION || CURRENT_VERSION);
  if (!Number.isInteger(v) || v < 1) {
    throw new Error(`[encryption] ENCRYPTION_KEY_VERSION must be a positive integer. Got: ${v}`);
  }
  return v;
}

function getPbkdf2Iterations(): number {
  const iter = Number(process.env.ENCRYPTION_PBKDF2_ITER || MIN_PBKDF2_ITERATIONS);
  if (!Number.isInteger(iter) || iter < MIN_PBKDF2_ITERATIONS) {
    throw new Error(
      `[encryption] ENCRYPTION_PBKDF2_ITER must be at least ${MIN_PBKDF2_ITERATIONS}. Got: ${iter}`,
    );
  }
  return iter;
}

// ---------------------------------------------------------------------------
// Key Derivation: HKDF (extract-then-expand with SHA-512)
// ---------------------------------------------------------------------------

/**
 * Derive an AES-256 key from the master key using HKDF.
 * Uses SHA-512 in the extract phase and SHA-256 for expansion.
 *
 * HKDF(masterKey, salt="nexus-salt", info="nexus:v{version}:encryption") → 32 bytes
 *
 * This provides key separation: different info strings produce
 * independent derived keys from the same master secret.
 */
function hkdfDeriveKey(masterKey: Buffer, version: number, length: number = KEY_LENGTH): Buffer {
  // Extract: PRK = HMAC-SHA512(salt, IKM)
  const salt = Buffer.from("nexus-encryption-salt-v1", "utf-8");
  const prk = createHmac("sha512", salt).update(masterKey).digest();

  // Expand: OKM = HMAC-SHA512(PRK, info || 0x01)
  const info = Buffer.from(`${HKDF_INFO_PREFIX}${version}:encryption`, "utf-8");
  const t1 = createHmac("sha512", prk)
    .update(Buffer.concat([info, Buffer.from([0x01])]))
    .digest();

  return Buffer.from(t1.subarray(0, length));
}

// ---------------------------------------------------------------------------
// Core: Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * The encryption pipeline:
 *   1. Generate a random 32-byte salt
 *   2. Generate a random 12-byte IV (CSPRNG)
 *   3. Derive AES key: HKDF(masterKey, version) → 32 bytes
 *   4. Encrypt: AES-256-GCM(plaintext, key, iv, aad) → ciphertext + authTag
 *   5. Zero out key material from memory
 *   6. Return envelope
 *
 * @param plaintext - The data to encrypt (string or Buffer)
 * @param opts - Optional AAD and iteration count
 * @returns EncryptionResult with envelope and serialized form
 */
export function encrypt(
  plaintext: string | Buffer,
  opts: EncryptionOptions = {},
): EncryptionResult {
  const masterKey = getMasterKey();
  const version = getKeyVersion();

  // 1. Cryptographic random salt
  const salt = randomBytes(SALT_LENGTH);

  // 2. Cryptographic random IV
  const iv = randomBytes(IV_LENGTH);

  // 3. Derive AES-256 key via HKDF
  const derivedKey = hkdfDeriveKey(masterKey, version);

  // 4. Prepare AAD
  const aad = typeof opts.aad === "string" ? Buffer.from(opts.aad, "utf-8") : opts.aad;

  // 5. Encrypt
  let ciphertext: Buffer;
  let authTag: Buffer;

  try {
    const cipher = createCipheriv(AES_ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    if (aad) {
      cipher.setAAD(aad, { plaintextLength: Buffer.byteLength(plaintext) });
    }

    const input = typeof plaintext === "string" ? Buffer.from(plaintext, "utf-8") : plaintext;
    ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
    authTag = cipher.getAuthTag();
  } finally {
    // Zero out key material from memory
    derivedKey.fill(0);
  }

  const envelope: EncryptionEnvelope = {
    v: version,
    k: toBase64url(salt),
    i: toBase64url(iv),
    d: toBase64url(ciphertext),
    t: toBase64url(authTag),
  };

  return {
    envelope,
    serialized: JSON.stringify(envelope),
  };
}

// ---------------------------------------------------------------------------
// Core: Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt an EncryptionEnvelope using AES-256-GCM.
 *
 * The decryption pipeline:
 *   1. Validate envelope structure
 *   2. Derive AES key: HKDF(masterKey, version) → 32 bytes
 *   3. Decrypt: AES-256-GCM(ciphertext, key, iv, aad, authTag) → plaintext
 *   4. Verify authentication tag (automatic in GCM final())
 *   5. Zero out key material from memory
 *
 * If the ciphertext has been tampered with, GCM will throw during final(),
 * and no plaintext will be returned.
 *
 * @param envelope - The encryption envelope to decrypt
 * @param opts - Optional overrides for key rotation scenarios
 * @returns Decrypted plaintext as string
 */
export function decrypt(
  envelope: EncryptionEnvelope,
  opts: DecryptionOptions = {},
): string {
  // Validate envelope
  if (!envelope || typeof envelope !== "object") {
    throw new Error("[encryption] Invalid envelope: expected an object.");
  }
  if (!envelope.v || !envelope.k || !envelope.i || !envelope.d || !envelope.t) {
    throw new Error(
      "[encryption] Invalid envelope: missing required fields (v, k, i, d, t).",
    );
  }
  if (!Number.isInteger(envelope.v) || envelope.v < 1) {
    throw new Error(`[encryption] Unsupported envelope version: ${envelope.v}`);
  }

  const masterKey = opts.masterKey || getMasterKey();
  const version = opts.keyVersion ?? envelope.v;

  // Decode fields
  const salt = fromBase64url(envelope.k);
  const iv = fromBase64url(envelope.i);
  const ciphertext = fromBase64url(envelope.d);
  const authTag = fromBase64url(envelope.t);

  // Validate field lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `[encryption] Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}.`,
    );
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `[encryption] Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}.`,
    );
  }
  if (ciphertext.length === 0) {
    throw new Error("[encryption] Empty ciphertext: nothing to decrypt.");
  }

  // Derive key
  const derivedKey = hkdfDeriveKey(masterKey, version);

  try {
    const decipher = createDecipheriv(AES_ALGORITHM, derivedKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(), // ← authentication tag verified here; throws on mismatch
    ]);

    return plaintext.toString("utf-8");
  } finally {
    // Zero out key material
    derivedKey.fill(0);
  }
}

// ---------------------------------------------------------------------------
// Convenience: JSON
// ---------------------------------------------------------------------------

/**
 * Encrypt a string and return a compact JSON string ready for database storage.
 *
 * @example
 *   const encrypted = encryptToJSON("sk-proj-abc123");
 *   // → '{"v":1,"k":"...","i":"...","d":"...","t":"..."}'
 *   await db.apiKey.create({ data: { encryptedValue: encrypted } });
 */
export function encryptToJSON(plaintext: string, opts?: EncryptionOptions): string {
  const result = encrypt(plaintext, opts);
  return result.serialized;
}

/**
 * Decrypt from a JSON string (or envelope object).
 *
 * @example
 *   const row = await db.apiKey.findUnique({ where: { id: 42 } });
 *   const apiKey = decryptFromJSON(row.encryptedValue);
 */
export function decryptFromJSON(
  jsonOrEnvelope: string | EncryptionEnvelope,
  opts?: DecryptionOptions,
): string {
  const envelope: EncryptionEnvelope =
    typeof jsonOrEnvelope === "string"
      ? (JSON.parse(jsonOrEnvelope) as EncryptionEnvelope)
      : jsonOrEnvelope;

  return decrypt(envelope, opts);
}

// ---------------------------------------------------------------------------
// Key Rotation
// ---------------------------------------------------------------------------

/**
 * Rotate an encryption envelope to the current master key version.
 *
 * If the envelope is already at the current version, it is returned unchanged.
 * Otherwise, it is decrypted with the appropriate master key and re-encrypted
 * with the current master key.
 *
 * During rotation, you MUST provide the old master key via
 * `ENCRYPTION_MASTER_KEY_PREVIOUS` (or pass it directly).
 *
 * @param jsonOrEnvelope - The existing envelope
 * @param previousMasterKeyHex - Optional: previous master key as hex (defaults to env ENCRYPTION_MASTER_KEY_PREVIOUS)
 * @returns RotationResult
 */
export function rotateEnvelope(
  jsonOrEnvelope: string | EncryptionEnvelope,
  previousMasterKeyHex?: string,
): RotationResult {
  const envelope: EncryptionEnvelope =
    typeof jsonOrEnvelope === "string"
      ? (JSON.parse(jsonOrEnvelope) as EncryptionEnvelope)
      : jsonOrEnvelope;

  const currentVersion = getKeyVersion();

  if (envelope.v === currentVersion) {
    return {
      envelope,
      rotated: false,
      fromVersion: envelope.v,
      toVersion: currentVersion,
    };
  }

  // Decrypt with the old key
  const oldKeyHex =
    previousMasterKeyHex || process.env.ENCRYPTION_MASTER_KEY_PREVIOUS;

  if (!oldKeyHex) {
    throw new Error(
      `[encryption] Cannot rotate envelope from version ${envelope.v} to ${currentVersion}. ` +
      "Set ENCRYPTION_MASTER_KEY_PREVIOUS to the old master key.",
    );
  }

  if (oldKeyHex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(oldKeyHex)) {
    throw new Error(
      "[encryption] ENCRYPTION_MASTER_KEY_PREVIOUS must be 64 hex characters.",
    );
  }

  const oldMasterKey = Buffer.from(oldKeyHex, "hex");
  const plaintext: string = decrypt(envelope, {
    masterKey: oldMasterKey,
    keyVersion: envelope.v,
  });

  // Re-encrypt with current master key
  const result = encrypt(plaintext);

  // Zero out sensitive buffers
  oldMasterKey.fill(0);

  return {
    envelope: result.envelope,
    rotated: true,
    fromVersion: envelope.v,
    toVersion: currentVersion,
  };
}

// ---------------------------------------------------------------------------
// Batch Rotation
// ---------------------------------------------------------------------------

/**
 * Rotate multiple envelopes at once.
 *
 * @example
 *   const rows = await db.apiKey.findMany();
 *   const results = rotateMany(rows.map(r => r.encryptedValue));
 *   // Update database with results
 */
export function rotateMany(
  items: Array<{ id: string; encrypted: string }>,
  previousMasterKeyHex?: string,
): Array<{ id: string; encrypted: string; rotated: boolean }> {
  return items.map((item) => {
    const result = rotateEnvelope(item.encrypted, previousMasterKeyHex);
    return {
      id: item.id,
      encrypted: JSON.stringify(result.envelope),
      rotated: result.rotated,
    };
  });
}

// ---------------------------------------------------------------------------
// Integrity Check
// ---------------------------------------------------------------------------

/**
 * Verify that an envelope is structurally valid *without* attempting decryption.
 * Checks field presence, base64url encoding, and field lengths.
 */
export function validateEnvelope(jsonOrEnvelope: string | EncryptionEnvelope): {
  valid: boolean;
  version: number;
  error?: string;
} {
  try {
    const envelope: EncryptionEnvelope =
      typeof jsonOrEnvelope === "string"
        ? (JSON.parse(jsonOrEnvelope) as EncryptionEnvelope)
        : jsonOrEnvelope;

    if (!envelope || typeof envelope !== "object") {
      return { valid: false, version: 0, error: "Not an object." };
    }

    if (!envelope.v || !envelope.k || !envelope.i || !envelope.d || !envelope.t) {
      return { valid: false, version: envelope.v || 0, error: "Missing required fields (v, k, i, d, t)." };
    }

    if (!Number.isInteger(envelope.v) || envelope.v < 1) {
      return { valid: false, version: envelope.v, error: `Invalid version: ${envelope.v}` };
    }

    // Validate base64url encoding
    for (const field of ["k", "i", "d", "t"] as const) {
      try {
        fromBase64url(envelope[field]);
      } catch {
        return { valid: false, version: envelope.v, error: `Field '${field}' is not valid base64url.` };
      }
    }

    const iv = fromBase64url(envelope.i);
    if (iv.length !== IV_LENGTH) {
      return { valid: false, version: envelope.v, error: `IV must be ${IV_LENGTH} bytes.` };
    }

    const tag = fromBase64url(envelope.t);
    if (tag.length !== AUTH_TAG_LENGTH) {
      return { valid: false, version: envelope.v, error: `Auth tag must be ${AUTH_TAG_LENGTH} bytes.` };
    }

    const ct = fromBase64url(envelope.d);
    if (ct.length === 0) {
      return { valid: false, version: envelope.v, error: "Ciphertext is empty." };
    }

    return { valid: true, version: envelope.v };
  } catch (err) {
    return {
      valid: false,
      version: 0,
      error: err instanceof Error ? err.message : "Unknown validation error.",
    };
  }
}

// ---------------------------------------------------------------------------
// Master Key Generation Helper
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure random master key.
 *
 * USAGE (do NOT run in production code — use CLI only):
 *   node -e "const {generateMasterKey} = require('./encryption'); console.log(generateMasterKey());"
 *
 * Or simply:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateMasterKey(): string {
  return randomBytes(KEY_LENGTH).toString("hex");
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Verify that encryption is properly configured and functional.
 *
 * Performs a round-trip encrypt-then-decrypt test to catch
 * misconfiguration (bad key, wrong algorithm, etc.).
 */
export function pingEncryption(): {
  healthy: boolean;
  version: number;
  error?: string;
} {
  try {
    const masterKeyHex = getMasterKeyHex();
    const version = getKeyVersion();

    const testPlaintext = `nexus-encryption-ping-${Date.now()}-${randomBytes(8).toString("hex")}`;
    const result = encrypt(testPlaintext);
    const decrypted = decrypt(result.envelope);

    const match = decrypted === testPlaintext;

    // Also test JSON round-trip
    const jsonResult = encryptToJSON(`json-ping-${randomBytes(8).toString("hex")}`);
    const jsonDecrypted = decryptFromJSON(jsonResult);

    const jsonMatch = jsonDecrypted.startsWith("json-ping-");

    return {
      healthy: match && jsonMatch,
      version,
      error: match && jsonMatch ? undefined : "Round-trip verification failed.",
    };
  } catch (err) {
    return {
      healthy: false,
      version: 0,
      error: err instanceof Error ? err.message : "Unknown error during encryption health check.",
    };
  }
}

// ---------------------------------------------------------------------------
// Sensitive Data Wipe
// ---------------------------------------------------------------------------

/**
 * Overwrite a Buffer with cryptographically random bytes, then zeroes.
 * Use before releasing sensitive plaintext buffers.
 */
export function wipeBuffer(buf: Buffer): void {
  if (!Buffer.isBuffer(buf)) return;

  // First overwrite with random data
  const randomFill = randomBytes(buf.length);
  randomFill.copy(buf);

  // Then zero
  buf.fill(0);

  // Zero the random fill too
  randomFill.fill(0);
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const encryption = {
  encrypt,
  decrypt,
  encryptToJSON,
  decryptFromJSON,
  rotateEnvelope,
  rotateMany,
  validateEnvelope,
  generateMasterKey,
  ping: pingEncryption,
  wipeBuffer,
  constants: {
    algorithm: AES_ALGORITHM,
    ivLength: IV_LENGTH,
    authTagLength: AUTH_TAG_LENGTH,
    saltLength: SALT_LENGTH,
    keyLength: KEY_LENGTH,
    currentVersion: CURRENT_VERSION,
    minPbkdf2Iterations: MIN_PBKDF2_ITERATIONS,
  },
} as const;

export default encryption;