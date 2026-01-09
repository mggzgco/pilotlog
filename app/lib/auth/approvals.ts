import crypto from "crypto";

export function createApprovalToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashApprovalToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyApprovalToken(token: string, tokenHash: string) {
  return hashApprovalToken(token) === tokenHash;
}

export function approvalTokenExpiry(days = 7) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
