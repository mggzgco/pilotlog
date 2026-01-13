import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// For AWS deployment, this should be backed by a persistent volume (EFS) or otherwise durable storage.
// Configure via UPLOAD_DIR=/mnt/efs/uploads (recommended) or leave unset for local dev.
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_RECEIPT_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png"
};

const safeExtensionPattern = /^[a-z0-9.]+$/i;
const safePrefixPattern = /^[a-z0-9._-]+$/i;

export function getReceiptExtension(contentType: string | null | undefined) {
  return getReceiptExtensionFrom(contentType, undefined);
}

export function getReceiptExtensionFrom(
  contentType: string | null | undefined,
  filename?: string | null
) {
  const byMime =
    contentType && ALLOWED_RECEIPT_MIME_TYPES[contentType]
      ? ALLOWED_RECEIPT_MIME_TYPES[contentType]
      : null;
  if (byMime) return byMime;

  // Some browsers/devices send an empty or generic MIME type for PDFs.
  if (filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pdf")) return ".pdf";
    if (lower.endsWith(".png")) return ".png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ".jpg";
  }

  return null;
}

export function isSafeStorageName(name: string) {
  return path.basename(name) === name && !name.includes("..");
}

export function getUploadPath(storageName: string) {
  if (!isSafeStorageName(storageName)) {
    return null;
  }
  return path.join(uploadDir, storageName);
}

export async function storeUpload(
  buffer: Buffer,
  extension: string,
  options?: { prefix?: string }
) {
  await fs.mkdir(uploadDir, { recursive: true });
  const normalizedExtension =
    extension.startsWith(".") && safeExtensionPattern.test(extension)
      ? extension
      : ".bin";
  const rawPrefix = options?.prefix ?? "";
  const safePrefix =
    rawPrefix && safePrefixPattern.test(rawPrefix) ? rawPrefix : "";
  const name = `${safePrefix}${crypto.randomBytes(16).toString("hex")}${normalizedExtension}`;
  const fullPath = path.join(uploadDir, name);
  await fs.writeFile(fullPath, buffer);
  return name;
}
