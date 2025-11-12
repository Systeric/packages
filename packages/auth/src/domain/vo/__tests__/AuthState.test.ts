import { describe, it, expect } from "vitest";
import { AuthState } from "../AuthState";

describe("AuthState", () => {
  describe("creation", () => {
    it("should generate random state", () => {
      const state1 = AuthState.generate();
      const state2 = AuthState.generate();

      expect(state1.getValue()).not.toBe(state2.getValue());
      expect(state1.getValue().length).toBeGreaterThan(20);
    });

    it("should create from existing value", () => {
      const value = "existing_state_value";
      const state = AuthState.fromString(value);

      expect(state.getValue()).toBe(value);
    });

    it("should throw for empty state", () => {
      expect(() => AuthState.fromString("")).toThrow("Auth state cannot be empty");
    });

    it("should throw for short state (< 16 chars)", () => {
      expect(() => AuthState.fromString("short")).toThrow(
        "Auth state must be at least 16 characters"
      );
    });
  });

  describe("validation", () => {
    it("should validate matching state", () => {
      const state = AuthState.generate();
      const received = AuthState.fromString(state.getValue());

      expect(state.validate(received)).toBe(true);
    });

    it("should reject different state", () => {
      const state1 = AuthState.generate();
      const state2 = AuthState.generate();

      expect(state1.validate(state2)).toBe(false);
    });

    it("should validate by string value", () => {
      const state = AuthState.generate();

      expect(state.validateString(state.getValue())).toBe(true);
      expect(state.validateString("different_value")).toBe(false);
    });
  });

  describe("expiry", () => {
    it("should not be expired immediately after creation", () => {
      const state = AuthState.generate();

      expect(state.isExpired()).toBe(false);
    });

    it("should be expired after custom TTL", () => {
      const state = AuthState.generate(0); // 0 seconds TTL

      expect(state.isExpired()).toBe(true);
    });

    it("should use default 10 minute TTL", () => {
      const state = AuthState.generate();
      const secondsLeft = state.secondsUntilExpiry();

      expect(secondsLeft).toBeGreaterThan(590); // ~10 min
      expect(secondsLeft).toBeLessThanOrEqual(600); // exactly 10 min
    });
  });

  describe("serialization", () => {
    it("should serialize to JSON", () => {
      const state = AuthState.generate();
      const json = state.toJSON();

      expect(json.value).toBe(state.getValue());
      expect(json.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should restore from JSON", () => {
      const original = AuthState.generate();
      const json = original.toJSON();
      const restored = AuthState.fromJSON(json);

      expect(restored.getValue()).toBe(original.getValue());
      expect(restored.validate(original)).toBe(true);
    });

    it("should throw when restoring expired state", () => {
      const json = {
        value: "expired_state_value_123456",
        expiresAt: Date.now() - 1000,
      };

      expect(() => AuthState.fromJSON(json)).toThrow("Auth state has expired");
    });
  });

  describe("equality", () => {
    it("should be equal if same value", () => {
      const value = "state_value_123456789";
      const state1 = AuthState.fromString(value);
      const state2 = AuthState.fromString(value);

      expect(state1.equals(state2)).toBe(true);
    });

    it("should not be equal if different values", () => {
      const state1 = AuthState.generate();
      const state2 = AuthState.generate();

      expect(state1.equals(state2)).toBe(false);
    });
  });
});
