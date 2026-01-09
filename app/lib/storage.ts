import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const uploadDir = path.join(process.cwd(), "uploads");

export async function storeUpload(file: File) {
  await fs.mkdir(uploadDir, { recursive: true });
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = path.extname(file.name) || ".bin";
  const name = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const fullPath = path.join(uploadDir, name);
  await fs.writeFile(fullPath, buffer);
  return name;
}
