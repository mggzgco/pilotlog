import { describe, expect, it, vi } from "vitest";
import {
  approvalTokenExpiry,
  hashApprovalToken,
  verifyApprovalToken
} from "@/app/lib/auth/approvals";

describe("token hashing and expiry", () => {
  it("verifies hashed approval tokens", () => {
    const token = "approval-token-value";
    const hash = hashApprovalToken(token);

    expect(verifyApprovalToken(token, hash)).toBe(true);
    expect(verifyApprovalToken("other-token", hash)).toBe(false);
  });

  it("sets approval token expiry based on days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const expiry = approvalTokenExpiry();
    const expected = new Date("2024-01-08T00:00:00Z");

    expect(expiry.toISOString()).toBe(expected.toISOString());

    vi.useRealTimers();
  });
});
