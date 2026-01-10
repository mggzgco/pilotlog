import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const uploadDir = path.join(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_RECEIPT_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png"
};

const safeExtensionPattern = /^[a-z0-9.]+$/i;

export function getReceiptExtension(contentType: string | null | undefined) {
  if (!contentType) {
    return null;
  }
  return ALLOWED_RECEIPT_MIME_TYPES[contentType] ?? null;
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
  const safePrefix = safeExtensionPattern.test(rawPrefix) ? rawPrefix : "";
  const name = `${safePrefix}${crypto.randomBytes(16).toString("hex")}${normalizedExtension}`;
  const fullPath = path.join(uploadDir, name);
  await fs.writeFile(fullPath, buffer);
  return name;
}
