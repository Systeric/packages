import { describe, it, expect } from "vitest";
import { AccessToken } from "../AccessToken";

describe("AccessToken", () => {
  describe("creation", () => {
    it("should create a valid access token", () => {
      const token = AccessToken.fromString("ya29.a0...", 3600);
      expect(token.getValue()).toBe("ya29.a0...");
      expect(token.isExpired()).toBe(false);
    });

    it("should throw for empty token", () => {
      expect(() => AccessToken.fromString("", 3600)).toThrow("Access token cannot be empty");
    });

    it("should throw for whitespace-only token", () => {
      expect(() => AccessToken.fromString("   ", 3600)).toThrow("Access token cannot be empty");
    });

    it("should allow negative expiry for expired tokens", () => {
      const token = AccessToken.fromString("token", -1);
      expect(token.isExpired()).toBe(true);
    });

    it("should allow zero expiry for expired tokens", () => {
      const token = AccessToken.fromString("token", 0);
      expect(token.isExpired()).toBe(true);
    });
  });

  describe("expiry", () => {
    it("should detect expired token", () => {
      const token = AccessToken.fromString("expired_token", 0);
      expect(token.isExpired()).toBe(true);
    });

    it("should detect non-expired token", () => {
      const token = AccessToken.fromString("valid_token", 3600);
      expect(token.isExpired()).toBe(false);
    });

    it("should calculate time until expiry", () => {
      const token = AccessToken.fromString("token", 3600);
      const secondsLeft = token.secondsUntilExpiry();
      expect(secondsLeft).toBeGreaterThan(3500);
      expect(secondsLeft).toBeLessThanOrEqual(3600);
    });

    it("should return 0 for expired token time left", () => {
      const token = AccessToken.fromString("expired", 0);
      expect(token.secondsUntilExpiry()).toBe(0);
    });

    it("should check if token needs refresh (< 5 min left)", () => {
      const tokenExpiring = AccessToken.fromString("token", 200); // 3.3 min
      const tokenValid = AccessToken.fromString("token", 600); // 10 min

      expect(tokenExpiring.needsRefresh()).toBe(true);
      expect(tokenValid.needsRefresh()).toBe(false);
    });
  });

  describe("equality", () => {
    it("should be equal if same token value", () => {
      const token1 = AccessToken.fromString("token123", 3600);
      const token2 = AccessToken.fromString("token123", 1800);

      expect(token1.equals(token2)).toBe(true);
    });

    it("should not be equal if different token values", () => {
      const token1 = AccessToken.fromString("token1", 3600);
      const token2 = AccessToken.fromString("token2", 3600);

      expect(token1.equals(token2)).toBe(false);
    });
  });

  describe("serialization", () => {
    it("should convert to JSON with expiry timestamp", () => {
      const now = Date.now();
      const token = AccessToken.fromString("token", 3600);
      const json = token.toJSON();

      expect(json.token).toBe("token");
      expect(json.expiresAt).toBeGreaterThan(now);
      expect(json.expiresAt).toBeLessThanOrEqual(now + 3600 * 1000);
    });

    it("should restore from JSON", () => {
      const original = AccessToken.fromString("token123", 3600);
      const json = original.toJSON();
      const restored = AccessToken.fromJSON(json);

      expect(restored.getValue()).toBe(original.getValue());
      expect(restored.isExpired()).toBe(original.isExpired());
    });

    it("should throw when restoring expired token from JSON", () => {
      const json = {
        token: "expired_token",
        expiresAt: Date.now() - 1000, // 1 second ago
      };

      expect(() => AccessToken.fromJSON(json)).toThrow("Token has expired");
    });
  });
});
