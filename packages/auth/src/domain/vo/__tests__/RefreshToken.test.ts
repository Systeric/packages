import { describe, it, expect } from "vitest";
import { RefreshToken } from "../RefreshToken";

describe("RefreshToken", () => {
  describe("creation", () => {
    it("should create a valid refresh token", () => {
      const token = RefreshToken.fromString("1//refresh_token_xyz");
      expect(token.getValue()).toBe("1//refresh_token_xyz");
    });

    it("should throw for empty token", () => {
      expect(() => RefreshToken.fromString("")).toThrow("Refresh token cannot be empty");
    });

    it("should throw for whitespace-only token", () => {
      expect(() => RefreshToken.fromString("   ")).toThrow("Refresh token cannot be empty");
    });
  });

  describe("equality", () => {
    it("should be equal if same token value", () => {
      const token1 = RefreshToken.fromString("token123");
      const token2 = RefreshToken.fromString("token123");

      expect(token1.equals(token2)).toBe(true);
    });

    it("should not be equal if different token values", () => {
      const token1 = RefreshToken.fromString("token1");
      const token2 = RefreshToken.fromString("token2");

      expect(token1.equals(token2)).toBe(false);
    });
  });

  describe("serialization", () => {
    it("should convert to JSON", () => {
      const token = RefreshToken.fromString("refresh_123");
      const json = token.toJSON();

      expect(json.token).toBe("refresh_123");
    });

    it("should restore from JSON", () => {
      const original = RefreshToken.fromString("refresh_xyz");
      const json = original.toJSON();
      const restored = RefreshToken.fromJSON(json);

      expect(restored.getValue()).toBe(original.getValue());
      expect(restored.equals(original)).toBe(true);
    });
  });

  describe("security", () => {
    it("should not expose token in toString", () => {
      const token = RefreshToken.fromString("secret_token_123");
      const str = token.toString();

      expect(str).not.toContain("secret_token_123");
      expect(str).toContain("RefreshToken");
    });

    it("should mask token for logging", () => {
      const token = RefreshToken.fromString("1//very_long_secret_token_abc123");
      const masked = token.toMaskedString();

      expect(masked).toBe("1//***abc123");
      expect(masked).not.toContain("very_long_secret");
    });

    it("should handle short tokens in masking", () => {
      const token = RefreshToken.fromString("short");
      const masked = token.toMaskedString();

      expect(masked).toBe("***");
    });
  });
});
