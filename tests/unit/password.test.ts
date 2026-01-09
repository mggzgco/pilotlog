import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/app/lib/password";

describe("password hashing", () => {
  it("verifies a valid password", async () => {
    const hash = await hashPassword("Sup3rS3cret!");
    await expect(verifyPassword(hash, "Sup3rS3cret!")).resolves.toBe(true);
  });

  it("rejects an invalid password", async () => {
    const hash = await hashPassword("Sup3rS3cret!");
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });
});
