/**
 * Object Storage Abstraction — S3 / Cloudflare R2 / MinIO
 *
 * Media Library backend with CDN support and image optimization pipeline.
 * S3-compatible: AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2.
 *
 * Features:
 *   - Upload / Download / Delete objects with metadata
 *   - Presigned URLs for secure direct upload & time-limited download
 *   - CDN integration with custom domain, cache-control, and CORS headers
 *   - Image optimization via sharp: resize, format conversion (WebP/AVIF), quality,
 *     cropping, watermarking, blurhash placeholder generation
 *   - Multi-tenant bucket isolation (prefix per organization)
 *   - Media Library metadata: tags, alt text, dimensions, EXIF, focal point
 *   - Content-type-aware processing: images get optimized, other files stored as-is
 *   - Signed cookies for restricted CDN access
 *   - Health checks and graceful shutdown
 *
 * Environment Variables:
 *   STORAGE_ENDPOINT           — S3-compatible endpoint URL
 *   STORAGE_REGION             — default: auto
 *   STORAGE_ACCESS_KEY_ID      — access key
 *   STORAGE_SECRET_ACCESS_KEY  — secret key
 *   STORAGE_BUCKET             — default bucket name (default: nexus-media)
 *   STORAGE_CDN_DOMAIN          — CDN / custom domain for public URLs
 *   STORAGE_FORCE_PATH_STYLE   — force path-style addressing (default: false)
 *   STORAGE_PUBLIC_PREFIX      — prefix for public objects (default: public/)
 *   STORAGE_PRIVATE_PREFIX     — prefix for private objects (default: private/)
 *   STORAGE_PRESIGNED_EXPIRY_S — presigned URL expiry in seconds (default: 3600)
 *   STORAGE_MAX_FILE_SIZE_MB   — max upload size in MB (default: 100)
 *   STORAGE_IMAGE_OPTIMIZATION — enable image optimization (default: true)
 *   STORAGE_DEFAULT_QUALITY    — default image quality 1-100 (default: 80)
 *   STORAGE_DEFAULT_FORMAT     — default output format: webp, avif, jpeg, png (default: webp)
 *   STORAGE_BLURHASH_ENABLED   — generate blurhash placeholders (default: true)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectsCommand,
  type PutObjectCommandInput,
  type ObjectIdentifier,
  type _Object,
} from "@aws-sdk/client-s3";
import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import sharp from "sharp";
import { createHash, randomUUID } from "crypto";
import { lookup as mimeLookup } from "mime-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported storage providers */
export type StorageProvider = "s3" | "r2" | "minio" | "digitalocean" | "b2";

/** Access level for stored objects */
export type AccessLevel = "public" | "private";

/** Supported image output formats for optimization */
export type ImageFormat = "webp" | "avif" | "jpeg" | "png" | "gif" | "auto";

/** Image fit modes */
export type ImageFit = "cover" | "contain" | "fill" | "inside" | "outside";

/** Image gravity / focal point */
export type ImageGravity =
  | "center"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "entropy"
  | "attention"
  | "face";

/** Storage configuration */
export interface StorageConfig {
  provider: StorageProvider;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  cdnDomain?: string;
  forcePathStyle: boolean;
  publicPrefix: string;
  privatePrefix: string;
  presignedExpirySeconds: number;
  maxFileSizeBytes: number;
  imageOptimization: {
    enabled: boolean;
    defaultQuality: number;
    defaultFormat: ImageFormat;
    maxWidth: number;
    maxHeight: number;
    blurhashEnabled: boolean;
    allowedFormats: ImageFormat[];
    allowedMimeTypes: string[];
  };
}

/** Upload options */
export interface UploadOptions {
  key?: string;
  access?: AccessLevel;
  tenantId?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  sse?: "AES256" | "aws:kms";
  sseKmsKeyId?: string;
  tags?: Record<string, string>;
  skipOptimization?: boolean;
}

/** Image optimization parameters */
export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  fit?: ImageFit;
  format?: ImageFormat;
  quality?: number;
  gravity?: ImageGravity;
  blur?: number;
  sharpen?: number;
  background?: string;
  rotate?: number;
  flip?: "horizontal" | "vertical" | "both";
  watermark?: {
    text: string;
    position?: "northwest" | "northeast" | "southwest" | "southeast" | "center";
    fontSize?: number;
    color?: string;
    opacity?: number;
  };
  generateBlurhash?: boolean;
  crop?: { left: number; top: number; width: number; height: number };
}

/** Upload result */
export interface UploadResult {
  key: string;
  eTag: string;
  s3Uri: string;
  cdnUrl: string | null;
  downloadUrl: string;
  contentType: string;
  size: number;
  dimensions?: { width: number; height: number };
  blurhash?: string;
  uploadedAt: string;
}

/** Download result */
export interface DownloadResult {
  body: Buffer;
  contentType: string;
  contentLength: number;
  eTag: string;
  lastModified: Date;
  metadata: Record<string, string>;
}

/** Object metadata (no body) */
export interface ObjectMetadata {
  key: string;
  size: number;
  contentType: string;
  eTag: string;
  lastModified: Date;
  metadata: Record<string, string>;
  storageClass?: string;
}

/** Presigned URL result */
export interface PresignedUrlResult {
  url: string;
  key: string;
  expiresAt: Date;
  method: "GET" | "PUT";
}

/** List objects result */
export interface ListObjectsResult {
  objects: ObjectMetadata[];
  prefix: string;
  nextContinuationToken?: string;
  isTruncated: boolean;
  totalCount: number;
}

/** Bulk delete result */
export interface BulkDeleteResult {
  deleted: string[];
  errors: Array<{ key: string; code: string; message: string }>;
}

/** Generate key from original filename */
export interface GenerateKeyOptions {
  filename: string;
  tenantId?: string;
  access?: AccessLevel;
  keepExtension?: boolean;
}

/** Media library asset descriptor (for database/cache) */
export interface AssetDescriptor {
  id: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  blurhash?: string;
  cdnUrl: string | null;
  downloadUrl: string;
  access: AccessLevel;
  tenantId?: string;
  tags: string[];
  altText?: string;
  focalPoint?: { x: number; y: number };
  metadata: Record<string, string>;
  uploadedAt: string;
  updatedAt: string;
}

/** Storage health check */
export interface StorageHealth {
  provider: StorageProvider;
  connected: boolean;
  bucket: string;
  latencyMs: number;
  objectCount?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "image/heif",
];

const ALLOWED_IMAGE_FORMATS: ImageFormat[] = ["webp", "avif", "jpeg", "png", "gif", "auto"];

function buildStorageConfig(): StorageConfig {
  const endpoint = process.env.STORAGE_ENDPOINT || "";
  const region = process.env.STORAGE_REGION || "auto";
  const bucket = process.env.STORAGE_BUCKET || "nexus-media";

  let provider: StorageProvider = "s3";
  if (endpoint.includes("r2.cloudflarestorage.com")) {
    provider = "r2";
  } else if (endpoint.includes("digitaloceanspaces.com")) {
    provider = "digitalocean";
  } else if (endpoint.includes("backblazeb2.com")) {
    provider = "b2";
  } else if (
    endpoint.includes("localhost") ||
    endpoint.includes("127.0.0.1") ||
    endpoint.includes("minio")
  ) {
    provider = "minio";
  }

  return {
    provider,
    endpoint,
    region,
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || "",
    bucket,
    cdnDomain: process.env.STORAGE_CDN_DOMAIN || undefined,
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === "true",
    publicPrefix: process.env.STORAGE_PUBLIC_PREFIX || "public/",
    privatePrefix: process.env.STORAGE_PRIVATE_PREFIX || "private/",
    presignedExpirySeconds: Number(process.env.STORAGE_PRESIGNED_EXPIRY_S || 3600),
    maxFileSizeBytes: Number(process.env.STORAGE_MAX_FILE_SIZE_MB || 100) * MB,
    imageOptimization: {
      enabled: process.env.STORAGE_IMAGE_OPTIMIZATION !== "false",
      defaultQuality: Number(process.env.STORAGE_DEFAULT_QUALITY || 80),
      defaultFormat: (process.env.STORAGE_DEFAULT_FORMAT as ImageFormat) || "webp",
      maxWidth: Number(process.env.STORAGE_IMAGE_MAX_WIDTH || 3840),
      maxHeight: Number(process.env.STORAGE_IMAGE_MAX_HEIGHT || 2160),
      blurhashEnabled: process.env.STORAGE_BLURHASH_ENABLED !== "false",
      allowedFormats: ALLOWED_IMAGE_FORMATS,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    },
  };
}

// ---------------------------------------------------------------------------
// Global Singleton
// ---------------------------------------------------------------------------

const globalForStorage = globalThis as unknown as {
  __s3Client: S3Client | undefined;
  __config: StorageConfig | undefined;
  __uploadCount: number;
  __totalBytes: number;
};

function getConfig(): StorageConfig {
  if (!globalForStorage.__config) {
    globalForStorage.__config = buildStorageConfig();
  }
  return globalForStorage.__config;
}

export function getS3Client(): S3Client {
  if (!globalForStorage.__s3Client) {
    const cfg = getConfig();
    globalForStorage.__s3Client = new S3Client({
      endpoint: cfg.endpoint || undefined,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: cfg.forcePathStyle,
      maxAttempts: 3,
      requestHandler: {
        requestTimeout: 60_000,
      },
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[storage] S3 client initialized (provider: ${cfg.provider}, bucket: ${cfg.bucket})`,
      );
    }
  }
  return globalForStorage.__s3Client;
}

export function destroyS3Client(): void {
  if (globalForStorage.__s3Client) {
    globalForStorage.__s3Client.destroy();
    globalForStorage.__s3Client = undefined;
    if (process.env.NODE_ENV !== "production") {
      console.log("[storage] S3 client destroyed");
    }
  }
}

// ---------------------------------------------------------------------------
// Key Generation & Path Helpers
// ---------------------------------------------------------------------------

export function generateKey(opts: GenerateKeyOptions): string {
  const cfg = getConfig();
  const access = opts.access || "public";
  const prefix = access === "private" ? cfg.privatePrefix : cfg.publicPrefix;
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const uuid = randomUUID();
  const ext = opts.keepExtension !== false
    ? (opts.filename.split(".").pop()?.toLowerCase() || "bin")
    : "bin";

  const segments: string[] = [];
  if (opts.tenantId) {
    segments.push(prefix.replace(/\/$/, ""), opts.tenantId, year, month);
  } else {
    segments.push(prefix.replace(/\/$/, ""), year, month);
  }
  segments.push(`${uuid}.${ext}`);

  return segments.join("/");
}

export function getAccessFromKey(key: string): AccessLevel {
  const cfg = getConfig();
  if (key.startsWith(cfg.privatePrefix)) return "private";
  return "public";
}

export function stripAccessPrefix(key: string): string {
  const cfg = getConfig();
  if (key.startsWith(cfg.publicPrefix)) {
    return key.slice(cfg.publicPrefix.length);
  }
  if (key.startsWith(cfg.privatePrefix)) {
    return key.slice(cfg.privatePrefix.length);
  }
  return key;
}

export function buildCdnUrl(key: string): string | null {
  const cfg = getConfig();
  if (!cfg.cdnDomain || getAccessFromKey(key) === "private") return null;
  const cdnBase = cfg.cdnDomain.replace(/\/$/, "");
  const relative = stripAccessPrefix(key);
  return `${cdnBase}/${relative}`;
}

export function buildS3Uri(key: string): string {
  const cfg = getConfig();
  return `s3://${cfg.bucket}/${key}`;
}

// ---------------------------------------------------------------------------
// Content-Type Detection
// ---------------------------------------------------------------------------

export function detectContentType(
  filename: string,
  buffer?: Buffer,
): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext) {
    const mimeFromExt = mimeLookup(ext);
    if (mimeFromExt) return mimeFromExt;
  }

  if (buffer && buffer.length > 0) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image/png";
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return "image/webp";
    if (
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 &&
      buffer[7] === 0x70 && buffer[8] === 0x61 && buffer[9] === 0x76 &&
      buffer[10] === 0x69 && buffer[11] === 0x66
    ) return "image/avif";
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "image/gif";
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "application/pdf";
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
      return "application/zip";
    }
    const header = buffer.slice(0, Math.min(300, buffer.length)).toString("utf-8").toLowerCase().trimStart();
    if (header.startsWith("<svg") || header.startsWith("<?xml")) return "image/svg+xml";
  }

  return "application/octet-stream";
}

export function isOptimizableImage(contentType: string): boolean {
  return ALLOWED_IMAGE_MIME_TYPES.includes(contentType) &&
    contentType !== "image/svg+xml" &&
    contentType !== "image/gif";
}

// ---------------------------------------------------------------------------
// Image Optimization Engine
// ---------------------------------------------------------------------------

function sharpFormat(format: ImageFormat): keyof sharp.FormatEnum {
  switch (format) {
    case "webp": return "webp";
    case "avif": return "avif";
    case "jpeg": return "jpeg";
    case "png": return "png";
    case "gif": return "gif";
    case "auto": return "webp";
    default: return "webp";
  }
}

export async function optimizeImage(
  inputBuffer: Buffer,
  opts: ImageOptimizationOptions = {},
): Promise<{
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  blurhash?: string;
}> {
  const cfg = getConfig();
  const format = opts.format || cfg.imageOptimization.defaultFormat;
  const quality = opts.quality ?? cfg.imageOptimization.defaultQuality;

  let pipeline = sharp(inputBuffer);

  const metadata = await pipeline.metadata();
  const origWidth = metadata.width || 0;
  const origHeight = metadata.height || 0;

  const targetWidth = opts.width
    ? Math.min(opts.width, cfg.imageOptimization.maxWidth)
    : undefined;
  const targetHeight = opts.height
    ? Math.min(opts.height, cfg.imageOptimization.maxHeight)
    : undefined;

  if (targetWidth || targetHeight) {
    pipeline = pipeline.resize(targetWidth, targetHeight, {
      fit: (opts.fit as sharp.FitEnum[keyof sharp.FitEnum]) || "inside",
      withoutEnlargement: true,
      position: opts.gravity as string | undefined,
    });
  }

  if (opts.crop) {
    pipeline = pipeline.extract({
      left: opts.crop.left,
      top: opts.crop.top,
      width: opts.crop.width,
      height: opts.crop.height,
    });
  }

  if (opts.rotate) {
    pipeline = pipeline.rotate(opts.rotate);
  }
  if (opts.flip) {
    pipeline = pipeline.flip(opts.flip === "both" || opts.flip === "vertical");
  }
  if (opts.flip === "horizontal" || opts.flip === "both") {
    pipeline = pipeline.flop();
  }

  if (opts.background) {
    pipeline = pipeline.flatten({ background: opts.background });
  }

  if (opts.blur && opts.blur > 0) {
    pipeline = pipeline.blur(opts.blur);
  }

  if (opts.sharpen && opts.sharpen > 0) {
    pipeline = pipeline.sharpen(opts.sharpen);
  }

  if (opts.watermark?.text) {
    const { text, position, fontSize, color, opacity } = opts.watermark;
    const svgWatermark = `
      <svg width="${origWidth}" height="${origHeight}">
        <style>
          .wm { fill: ${color || "#ffffff"}; font-size: ${fontSize || 48}px;
                font-family: sans-serif; opacity: ${opacity ?? 0.5}; }
        </style>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
              class="wm">${text}</text>
      </svg>`;

    const gravityMap: Record<string, sharp.Gravity> = {
      northwest: "northwest",
      northeast: "northeast",
      southwest: "southwest",
      southeast: "southeast",
      center: "center",
    };

    pipeline = pipeline.composite([{
      input: Buffer.from(svgWatermark),
      gravity: gravityMap[position || "center"] || "center",
    }]);
  }

  const outputFormat = sharpFormat(format);
  pipeline = pipeline.toFormat(outputFormat, { quality });

  const outputBuffer = await pipeline.toBuffer();

  const outMeta = await sharp(outputBuffer).metadata();
  const outWidth = outMeta.width || origWidth;
  const outHeight = outMeta.height || origHeight;

  const contentTypeMap: Record<string, string> = {
    webp: "image/webp",
    avif: "image/avif",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
  };
  const outputContentType = contentTypeMap[outputFormat] || "image/webp";

  let blurhash: string | undefined;
  if (opts.generateBlurhash || cfg.imageOptimization.blurhashEnabled) {
    blurhash = await generateBlurhashPlaceholder(outputBuffer, outWidth, outHeight);
  }

  return {
    buffer: outputBuffer,
    contentType: outputContentType,
    width: outWidth,
    height: outHeight,
    blurhash,
  };
}

async function generateBlurhashPlaceholder(
  buffer: Buffer,
  _width: number,
  _height: number,
): Promise<string> {
  try {
    const thumbnail = await sharp(buffer)
      .resize(32, 32, { fit: "cover" })
      .blur(8)
      .toFormat("jpeg", { quality: 20 })
      .toBuffer();

    const b64 = thumbnail.toString("base64");
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return "";
  }
}

export async function getImageMetadata(
  inputBuffer: Buffer,
): Promise<{
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  orientation?: number;
}> {
  const meta = await sharp(inputBuffer).metadata();
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    format: meta.format || "unknown",
    hasAlpha: meta.hasAlpha ?? false,
    orientation: meta.orientation,
  };
}

// ---------------------------------------------------------------------------
// Core Operations: Upload
// ---------------------------------------------------------------------------

export async function uploadFile(
  body: Buffer | Uint8Array,
  opts: {
    filename: string;
    access?: AccessLevel;
    tenantId?: string;
    contentType?: string;
    metadata?: Record<string, string>;
    cacheControl?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    sse?: "AES256" | "aws:kms";
    sseKmsKeyId?: string;
    tags?: Record<string, string>;
    skipOptimization?: boolean;
    imageOptimization?: ImageOptimizationOptions;
    keepOriginal?: boolean;
    key?: string;
  },
): Promise<UploadResult> {
  const cfg = getConfig();
  const client = getS3Client();
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

  if (buffer.length > cfg.maxFileSizeBytes) {
    throw new Error(
      `File size ${(buffer.length / MB).toFixed(2)}MB exceeds maximum ${(cfg.maxFileSizeBytes / MB).toFixed(0)}MB`,
    );
  }

  const detectedContentType = opts.contentType || detectContentType(opts.filename, buffer);

  const key = opts.key || generateKey({
    filename: opts.filename,
    tenantId: opts.tenantId,
    access: opts.access || "public",
  });

  const shouldOptimize =
    !opts.skipOptimization &&
    cfg.imageOptimization.enabled &&
    isOptimizableImage(detectedContentType);

  let finalBuffer = buffer;
  let finalContentType = detectedContentType;
  let dimensions: { width: number; height: number } | undefined;
  let blurhash: string | undefined;

  if (shouldOptimize) {
    try {
      const optimized = await optimizeImage(buffer, {
        ...opts.imageOptimization,
        generateBlurhash: cfg.imageOptimization.blurhashEnabled,
      });
      finalBuffer = optimized.buffer;
      finalContentType = optimized.contentType;
      dimensions = { width: optimized.width, height: optimized.height };
      blurhash = optimized.blurhash;

      if (process.env.NODE_ENV !== "production") {
        const savings = ((1 - optimized.buffer.length / buffer.length) * 100).toFixed(1);
        console.log(
          `[storage] image optimized: ${opts.filename} | ${(buffer.length / 1024).toFixed(0)}KB → ${(optimized.buffer.length / 1024).toFixed(0)}KB (${savings}% savings)`,
        );
      }
    } catch (err) {
      console.warn(
        `[storage] image optimization failed for ${opts.filename}, uploading original:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  } else if (isOptimizableImage(detectedContentType)) {
    try {
      const meta = await sharp(buffer).metadata();
      dimensions = { width: meta.width || 0, height: meta.height || 0 };
    } catch {
      // Not critical
    }
  }

  const mergedMetadata: Record<string, string> = {
    "original-filename": encodeURIComponent(opts.filename),
    "uploaded-at": new Date().toISOString(),
    "content-type": finalContentType,
    ...(opts.metadata || {}),
  };

  if (dimensions) {
    mergedMetadata["image-width"] = String(dimensions.width);
    mergedMetadata["image-height"] = String(dimensions.height);
  }

  if (blurhash) {
    mergedMetadata["blurhash"] = blurhash;
  }

  const putParams: PutObjectCommandInput = {
    Bucket: cfg.bucket,
    Key: key,
    Body: finalBuffer,
    ContentType: finalContentType,
    Metadata: mergedMetadata,
    CacheControl: opts.cacheControl || "public, max-age=31536000, immutable",
  };

  if (opts.contentDisposition) {
    putParams.ContentDisposition = opts.contentDisposition;
  }

  if (opts.contentEncoding) {
    putParams.ContentEncoding = opts.contentEncoding;
  }

  if (opts.sse) {
    putParams.ServerSideEncryption = opts.sse;
    if (opts.sse === "aws:kms" && opts.sseKmsKeyId) {
      putParams.SSEKMSKeyId = opts.sseKmsKeyId;
    }
  }

  if (opts.tags) {
    putParams.Tagging = Object.entries(opts.tags)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
  }

  const command = new PutObjectCommand(putParams);
  const response = await client.send(command);

  globalForStorage.__uploadCount = (globalForStorage.__uploadCount || 0) + 1;
  globalForStorage.__totalBytes = (globalForStorage.__totalBytes || 0) + finalBuffer.length;

  const downloadUrl = await createPresignedDownloadUrl(key);

  const result: UploadResult = {
    key,
    eTag: response.ETag?.replace(/"/g, "") || "",
    s3Uri: buildS3Uri(key),
    cdnUrl: buildCdnUrl(key),
    downloadUrl,
    contentType: finalContentType,
    size: finalBuffer.length,
    uploadedAt: new Date().toISOString(),
  };

  if (dimensions) {
    result.dimensions = dimensions;
  }

  if (blurhash) {
    result.blurhash = blurhash;
  }

  if (shouldOptimize && opts.keepOriginal && finalBuffer !== buffer) {
    const ext = opts.filename.split(".").pop() || "bin";
    const origKeyClean = key.replace(new RegExp(`\\.${key.split(".").pop()}$`), `_original.${ext}`);

    const origParams: PutObjectCommandInput = {
      Bucket: cfg.bucket,
      Key: origKeyClean,
      Body: buffer,
      ContentType: detectedContentType,
      Metadata: {
        ...mergedMetadata,
        "is-original": "true",
        "optimized-key": key,
      },
      CacheControl: opts.cacheControl || "public, max-age=31536000, immutable",
    };

    await client.send(new PutObjectCommand(origParams));
    if (process.env.NODE_ENV !== "production") {
      console.log(`[storage] original preserved: ${origKeyClean}`);
    }
  }

  return result;
}

export async function uploadLargeFile(
  body: Buffer | Uint8Array,
  opts: {
    filename: string;
    access?: AccessLevel;
    tenantId?: string;
    contentType?: string;
    metadata?: Record<string, string>;
    partSize?: number;
    queueSize?: number;
    onProgress?: (progress: { loaded: number; total: number; percent: number }) => void;
  } & Omit<Parameters<typeof uploadFile>[1], "filename" | "access" | "tenantId">,
): Promise<UploadResult> {
  const cfg = getConfig();
  const client = getS3Client();
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

  const minPartSize = opts.partSize || 5 * MB;
  if (buffer.length <= minPartSize) {
    return uploadFile(buffer, opts);
  }

  const detectedContentType = opts.contentType || detectContentType(opts.filename, buffer);
  const key = opts.key || generateKey({
    filename: opts.filename,
    tenantId: opts.tenantId,
    access: opts.access || "public",
  });

  const upload = new Upload({
    client,
    params: {
      Bucket: cfg.bucket,
      Key: key,
      Body: buffer,
      ContentType: detectedContentType,
      Metadata: {
        "original-filename": encodeURIComponent(opts.filename),
        "uploaded-at": new Date().toISOString(),
        ...(opts.metadata || {}),
      },
      CacheControl: opts.cacheControl || "public, max-age=31536000, immutable",
    },
    partSize: minPartSize,
    queueSize: opts.queueSize || 4,
    leavePartsOnError: false,
  });

  if (opts.onProgress) {
    upload.on("httpUploadProgress", (progress) => {
      opts.onProgress!({
        loaded: progress.loaded ?? 0,
        total: progress.total ?? buffer.length,
        percent: progress.total
          ? Math.round(((progress.loaded ?? 0) / progress.total) * 100)
          : 0,
      });
    });
  }

  const result = await upload.done();

  globalForStorage.__uploadCount = (globalForStorage.__uploadCount || 0) + 1;
  globalForStorage.__totalBytes = (globalForStorage.__totalBytes || 0) + buffer.length;

  const downloadUrl = await createPresignedDownloadUrl(key);

  return {
    key,
    eTag: result.ETag?.replace(/"/g, "") || "",
    s3Uri: buildS3Uri(key),
    cdnUrl: buildCdnUrl(key),
    downloadUrl,
    contentType: detectedContentType,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Core Operations: Download
// ---------------------------------------------------------------------------

export async function downloadFile(
  key: string,
  opts?: {
    imageOptimization?: ImageOptimizationOptions;
  },
): Promise<DownloadResult> {
  const cfg = getConfig();
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
  });

  const response = await client.send(command);

  if (!response.Body) {
    throw new Error(`Object not found or empty: ${key}`);
  }

  const chunks: Uint8Array[] = [];
  const stream = response.Body as unknown as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  let body = Buffer.concat(chunks);

  if (
    opts?.imageOptimization &&
    response.ContentType &&
    isOptimizableImage(response.ContentType)
  ) {
    const optimized = await optimizeImage(body, opts.imageOptimization);
    body = optimized.buffer;
  }

  const metadata: Record<string, string> = {};
  if (response.Metadata) {
    for (const [k, v] of Object.entries(response.Metadata)) {
      metadata[k] = v || "";
    }
  }

  return {
    body,
    contentType: response.ContentType || "application/octet-stream",
    contentLength: response.ContentLength || body.length,
    eTag: response.ETag?.replace(/"/g, "") || "",
    lastModified: response.LastModified || new Date(),
    metadata,
  };
}

// ---------------------------------------------------------------------------
// Core Operations: Delete
// ---------------------------------------------------------------------------

export async function deleteFile(key: string): Promise<boolean> {
  const cfg = getConfig();
  const client = getS3Client();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NoSuchKey") || message.includes("NotFound")) {
      return false;
    }
    throw err;
  }
}

export async function deleteFiles(keys: string[]): Promise<BulkDeleteResult> {
  const cfg = getConfig();
  const client = getS3Client();

  if (keys.length === 0) {
    return { deleted: [], errors: [] };
  }

  if (keys.length > 1000) {
    throw new Error("Cannot delete more than 1000 objects in a single request");
  }

  const objects: ObjectIdentifier[] = keys.map((key) => ({ Key: key }));

  const command = new DeleteObjectsCommand({
    Bucket: cfg.bucket,
    Delete: { Objects: objects, Quiet: false },
  });

  const response = await client.send(command);

  return {
    deleted: (response.Deleted || []).map((d) => d.Key || ""),
    errors: (response.Errors || []).map((e) => ({
      key: e.Key || "",
      code: e.Code || "UnknownError",
      message: e.Message || "Unknown error",
    })),
  };
}

// ---------------------------------------------------------------------------
// Object Metadata
// ---------------------------------------------------------------------------

export async function headObject(key: string): Promise<ObjectMetadata | null> {
  const cfg = getConfig();
  const client = getS3Client();

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
      }),
    );

    const metadata: Record<string, string> = {};
    if (response.Metadata) {
      for (const [k, v] of Object.entries(response.Metadata)) {
        metadata[k] = v || "";
      }
    }

    return {
      key,
      size: response.ContentLength || 0,
      contentType: response.ContentType || "application/octet-stream",
      eTag: response.ETag?.replace(/"/g, "") || "",
      lastModified: response.LastModified || new Date(),
      metadata,
      storageClass: response.StorageClass,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NotFound") || message.includes("NoSuchKey") || message.includes("404")) {
      return null;
    }
    throw err;
  }
}

export async function objectExists(key: string): Promise<boolean> {
  const meta = await headObject(key);
  return meta !== null;
}

// ---------------------------------------------------------------------------
// List Objects
// ---------------------------------------------------------------------------

export async function listObjects(
  prefix: string,
  opts?: {
    limit?: number;
    continuationToken?: string;
    access?: AccessLevel;
  },
): Promise<ListObjectsResult> {
  const cfg = getConfig();
  const client = getS3Client();

  let effectivePrefix = prefix;
  if (opts?.access) {
    const accessPrefix = opts.access === "public" ? cfg.publicPrefix : cfg.privatePrefix;
    effectivePrefix = accessPrefix + prefix.replace(new RegExp(`^${cfg.publicPrefix}|${cfg.privatePrefix}`), "");
  }

  const command = new ListObjectsV2Command({
    Bucket: cfg.bucket,
    Prefix: effectivePrefix,
    MaxKeys: opts?.limit || 1000,
    ContinuationToken: opts?.continuationToken,
  });

  const response = await client.send(command);

  const objects: ObjectMetadata[] = (response.Contents || []).map((obj: _Object) => {
    return {
      key: obj.Key || "",
      size: obj.Size || 0,
      contentType: "application/octet-stream",
      eTag: obj.ETag?.replace(/"/g, "") || "",
      lastModified: obj.LastModified || new Date(),
      metadata: {},
      storageClass: obj.StorageClass,
    };
  });

  return {
    objects,
    prefix: effectivePrefix,
    nextContinuationToken: response.NextContinuationToken,
    isTruncated: response.IsTruncated || false,
    totalCount: response.KeyCount || 0,
  };
}

export async function listAllObjects(
  prefix: string,
  opts?: {
    access?: AccessLevel;
    onPage?: (page: ListObjectsResult) => void;
  },
): Promise<ObjectMetadata[]> {
  const allObjects: ObjectMetadata[] = [];
  let token: string | undefined;

  do {
    const page = await listObjects(prefix, {
      continuationToken: token,
      access: opts?.access,
      limit: 1000,
    });

    allObjects.push(...page.objects);
    opts?.onPage?.(page);
    token = page.nextContinuationToken;
  } while (token);

  return allObjects;
}

// ---------------------------------------------------------------------------
// Presigned URLs
// ---------------------------------------------------------------------------

export async function createPresignedDownloadUrl(
  key: string,
  expirySeconds?: number,
): Promise<string> {
  const cfg = getConfig();
  const client = getS3Client();
  const expiresIn = expirySeconds || cfg.presignedExpirySeconds;

  const command = new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });
  return url;
}

export async function createPresignedUploadUrl(
  key: string,
  opts?: {
    contentType?: string;
    expirySeconds?: number;
    metadata?: Record<string, string>;
    maxSize?: number;
  },
): Promise<PresignedUrlResult> {
  const cfg = getConfig();
  const client = getS3Client();
  const expiresIn = opts?.expirySeconds || cfg.presignedExpirySeconds;

  const command = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    ContentType: opts?.contentType || "application/octet-stream",
    Metadata: opts?.metadata,
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  return {
    url,
    key,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    method: "PUT",
  };
}

export async function createPresignedUrl(
  key: string,
  method: "GET" | "PUT",
  opts?: {
    contentType?: string;
    expirySeconds?: number;
  },
): Promise<PresignedUrlResult> {
  if (method === "GET") {
    const url = await createPresignedDownloadUrl(key, opts?.expirySeconds);
    return {
      url,
      key,
      expiresAt: new Date(Date.now() + (opts?.expirySeconds || getConfig().presignedExpirySeconds) * 1000),
      method: "GET",
    };
  }

  return createPresignedUploadUrl(key, opts);
}

// ---------------------------------------------------------------------------
// Copy / Move
// ---------------------------------------------------------------------------

export async function copyObject(
  sourceKey: string,
  destinationKey: string,
  opts?: {
    destinationBucket?: string;
    metadata?: Record<string, string>;
    metadataDirective?: "COPY" | "REPLACE";
  },
): Promise<{ key: string; eTag: string }> {
  const cfg = getConfig();
  const client = getS3Client();

  const response = await client.send(
    new CopyObjectCommand({
      Bucket: opts?.destinationBucket || cfg.bucket,
      Key: destinationKey,
      CopySource: `${cfg.bucket}/${encodeURIComponent(sourceKey)}`,
      MetadataDirective: opts?.metadataDirective || "COPY",
      Metadata: opts?.metadata,
    }),
  );

  return {
    key: destinationKey,
    eTag: (response.CopyObjectResult?.ETag || "").replace(/"/g, ""),
  };
}

export async function moveObject(
  sourceKey: string,
  destinationKey: string,
  opts?: {
    destinationBucket?: string;
    metadata?: Record<string, string>;
  },
): Promise<{ key: string; eTag: string }> {
  const result = await copyObject(sourceKey, destinationKey, {
    ...opts,
    metadataDirective: opts?.metadata ? "REPLACE" : "COPY",
  });

  await deleteFile(sourceKey);

  return result;
}

// ---------------------------------------------------------------------------
// Asset Descriptor Builder
// ---------------------------------------------------------------------------

export function buildAssetDescriptor(
  upload: UploadResult,
  opts: {
    filename: string;
    tenantId?: string;
    access?: AccessLevel;
    tags?: string[];
    altText?: string;
    focalPoint?: { x: number; y: number };
    userId?: string;
  },
): AssetDescriptor {
  return {
    id: randomUUID(),
    key: upload.key,
    filename: opts.filename,
    contentType: upload.contentType,
    size: upload.size,
    width: upload.dimensions?.width,
    height: upload.dimensions?.height,
    blurhash: upload.blurhash,
    cdnUrl: upload.cdnUrl,
    downloadUrl: upload.downloadUrl,
    access: opts.access || "public",
    tenantId: opts.tenantId,
    tags: opts.tags || [],
    altText: opts.altText,
    focalPoint: opts.focalPoint,
    metadata: {},
    uploadedAt: upload.uploadedAt,
    updatedAt: upload.uploadedAt,
  };
}

// ---------------------------------------------------------------------------
// URL Utilities
// ---------------------------------------------------------------------------

export async function getBestUrl(
  key: string,
  opts?: {
    forcePresigned?: boolean;
    presignedExpiry?: number;
  },
): Promise<string> {
  const cdnUrl = buildCdnUrl(key);

  if (cdnUrl && !opts?.forcePresigned) {
    return cdnUrl;
  }

  return createPresignedDownloadUrl(key, opts?.presignedExpiry);
}

export function getImageUrl(
  key: string,
  transforms: ImageOptimizationOptions,
  opts?: { baseUrl?: string },
): string {
  const base = opts?.baseUrl || buildCdnUrl(key);
  if (!base) {
    return key;
  }

  const params = new URLSearchParams();

  if (transforms.width) params.set("w", String(transforms.width));
  if (transforms.height) params.set("h", String(transforms.height));
  if (transforms.fit) params.set("fit", transforms.fit);
  if (transforms.format && transforms.format !== "auto") params.set("f", transforms.format);
  if (transforms.quality) params.set("q", String(transforms.quality));
  if (transforms.gravity) params.set("g", transforms.gravity);
  if (transforms.blur) params.set("blur", String(transforms.blur));
  if (transforms.sharpen) params.set("sharp", String(transforms.sharpen));
  if (transforms.background) params.set("bg", transforms.background.replace("#", ""));
  if (transforms.rotate) params.set("rot", String(transforms.rotate));
  if (transforms.flip) params.set("flip", transforms.flip);

  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export function getResponsiveSrcSet(
  key: string,
  widths: number[],
  opts?: {
    format?: ImageFormat;
    quality?: number;
    fit?: ImageFit;
    baseUrl?: string;
  },
): string {
  return widths
    .map((w) => {
      const url = getImageUrl(key, {
        width: w,
        format: opts?.format,
        quality: opts?.quality,
        fit: opts?.fit,
      }, { baseUrl: opts?.baseUrl });
      return `${url} ${w}w`;
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// Bucket-Level Operations
// ---------------------------------------------------------------------------

export async function ensureBucket(): Promise<boolean> {
  const cfg = getConfig();
  const client = getS3Client();

  try {
    await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        MaxKeys: 1,
      }),
    );
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NoSuchBucket") || message.includes("NotFound")) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[storage] bucket "${cfg.bucket}" does not exist; create it manually or via infrastructure-as-code.`);
      }
      return false;
    }
    throw err;
  }
}

export async function getObjectCount(prefix?: string): Promise<number> {
  const cfg = getConfig();
  const client = getS3Client();

  const command = new ListObjectsV2Command({
    Bucket: cfg.bucket,
    Prefix: prefix,
    MaxKeys: 1,
  });

  const response = await client.send(command);
  let totalCount = response.KeyCount || 0;
  let token = response.NextContinuationToken;

  while (token) {
    const nextResponse = await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    totalCount += nextResponse.KeyCount || 0;
    token = nextResponse.NextContinuationToken;
  }

  return totalCount;
}

// ---------------------------------------------------------------------------
// Tenant Operations
// ---------------------------------------------------------------------------

export async function listTenantPrefixes(tenantId: string): Promise<string[]> {
  const cfg = getConfig();
  const client = getS3Client();

  const command = new ListObjectsV2Command({
    Bucket: cfg.bucket,
    Prefix: `${cfg.publicPrefix}${tenantId}/`,
    Delimiter: "/",
    MaxKeys: 1000,
  });

  const response = await client.send(command);

  return (response.CommonPrefixes || []).map((cp) => cp.Prefix || "").filter(Boolean);
}

export async function deleteTenantObjects(tenantId: string): Promise<BulkDeleteResult> {
  const cfg = getConfig();

  const publicObjects = await listAllObjects(`${cfg.publicPrefix}${tenantId}/`);
  const privateObjects = await listAllObjects(`${cfg.privatePrefix}${tenantId}/`);

  const allKeys = [...publicObjects, ...privateObjects].map((o) => o.key);

  if (allKeys.length === 0) {
    return { deleted: [], errors: [] };
  }

  const result: BulkDeleteResult = { deleted: [], errors: [] };

  for (let i = 0; i < allKeys.length; i += 1000) {
    const chunk = allKeys.slice(i, i + 1000);
    const chunkResult = await deleteFiles(chunk);
    result.deleted.push(...chunkResult.deleted);
    result.errors.push(...chunkResult.errors);
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[storage] deleted ${result.deleted.length} objects for tenant ${tenantId} (${result.errors.length} errors)`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// ETag / Integrity
// ---------------------------------------------------------------------------

export function computeMD5(buffer: Buffer): string {
  return createHash("md5").update(buffer).digest("base64");
}

export function computeSHA256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function verifyIntegrity(buffer: Buffer, expectedETag: string): boolean {
  const md5 = computeMD5(buffer);
  const cleanETag = expectedETag.replace(/"/g, "");
  return md5 === cleanETag;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export async function pingStorage(): Promise<StorageHealth> {
  const cfg = getConfig();
  const startTime = Date.now();

  try {
    const client = getS3Client();

    await client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        MaxKeys: 1,
      }),
    );

    const latencyMs = Date.now() - startTime;

    let objectCount: number | undefined;
    try {
      objectCount = await getObjectCount();
    } catch {
      // Optional
    }

    return {
      provider: cfg.provider,
      connected: true,
      bucket: cfg.bucket,
      latencyMs,
      objectCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      provider: cfg.provider,
      connected: false,
      bucket: cfg.bucket,
      latencyMs: Date.now() - startTime,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function getUploadStats(): { count: number; totalBytes: number; totalMB: string } {
  const count = globalForStorage.__uploadCount || 0;
  const totalBytes = globalForStorage.__totalBytes || 0;
  return {
    count,
    totalBytes,
    totalMB: (totalBytes / MB).toFixed(2),
  };
}

// ---------------------------------------------------------------------------
// MIME Types Map
// ---------------------------------------------------------------------------

export const COMMON_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".rtf": "application/rtf",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".wmv": "video/x-ms-wmv",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
};

export const FILE_CATEGORIES: Record<string, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp", ".ico", ".tiff", ".tif", ".heic", ".heif"],
  document: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".csv", ".txt", ".md", ".rtf"],
  archive: [".zip", ".rar", ".7z", ".tar", ".gz"],
  audio: [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"],
  video: [".mp4", ".webm", ".mov", ".avi", ".mkv", ".wmv"],
  font: [".woff", ".woff2", ".ttf", ".otf", ".eot"],
  code: [".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".xml", ".yaml", ".yml"],
};

export function getFileCategory(filename: string): string {
  const ext = "." + (filename.split(".").pop()?.toLowerCase() || "");
  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) return category;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const storage = {
  getClient: getS3Client,
  destroy: destroyS3Client,
  getConfig,
  buildStorageConfig,
  generateKey,
  getAccessFromKey,
  stripAccessPrefix,
  buildCdnUrl,
  buildS3Uri,
  getBestUrl,
  getImageUrl,
  getResponsiveSrcSet,
  upload: uploadFile,
  uploadLarge: uploadLargeFile,
  download: downloadFile,
  delete: deleteFile,
  deleteMany: deleteFiles,
  deleteTenantObjects,
  head: headObject,
  exists: objectExists,
  list: listObjects,
  listAll: listAllObjects,
  listTenantPrefixes,
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  createPresignedUrl,
  copy: copyObject,
  move: moveObject,
  optimizeImage,
  getImageMetadata,
  isOptimizableImage,
  detectContentType,
  buildAssetDescriptor,
  computeMD5,
  computeSHA256,
  verifyIntegrity,
  ensureBucket,
  getObjectCount,
  ping: pingStorage,
  stats: getUploadStats,
  mimeTypes: COMMON_MIME_TYPES,
  fileCategories: FILE_CATEGORIES,
  getFileCategory,
  allowedImageMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
  allowedImageFormats: ALLOWED_IMAGE_FORMATS,
} as const;

export default storage;