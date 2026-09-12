import { describe, expect, it } from "bun:test";
import { hashPassword, verifyPassword, createSession, verifySessionPayload, verifySession } from "../server/auth";

describe("Authentication & Session Security", () => {
  it("hashes password with bcrypt and verifies correctly", async () => {
    const password = "SuperSecretPassword123!";
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash.startsWith("$2")).toBe(true);

    const match = await verifyPassword(password, hash);
    expect(match).toBe(true);

    const wrongMatch = await verifyPassword("WrongPassword", hash);
    expect(wrongMatch).toBe(false);
  });

  it("creates and verifies HMAC-signed session tokens", () => {
    const userId = 42;
    const token = createSession(userId);
    expect(token).toBeDefined();
    expect(token.includes(".")).toBe(true);

    const verifiedUid = verifySession(token);
    expect(verifiedUid).toBe(userId);

    const payload = verifySessionPayload(token);
    expect(payload).not.toBeNull();
    expect(payload?.uid).toBe(userId);
    expect(payload?.exp).toBeGreaterThan(Date.now());
  });

  it("handles impersonation sessions properly", () => {
    const targetUserId = 100;
    const adminId = 1;
    const token = createSession(targetUserId, { impersonatedFrom: adminId });
    const payload = verifySessionPayload(token);

    expect(payload?.uid).toBe(targetUserId);
    expect(payload?.imp).toBe(adminId);
  });

  it("rejects tampered session tokens", () => {
    const token = createSession(5);
    const [payload, sig] = token.split(".");
    const tampered = `${payload}.invalidsignature123`;

    expect(verifySession(tampered)).toBeNull();
    expect(verifySessionPayload(tampered)).toBeNull();
  });

  it("rejects null or empty tokens safely", () => {
    expect(verifySession("")).toBeNull();
    expect(verifySession(null)).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession("garbage.token")).toBeNull();
  });
});
