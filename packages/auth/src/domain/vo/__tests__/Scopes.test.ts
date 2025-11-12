import { describe, it, expect } from "vitest";
import { Scopes } from "../Scopes";

describe("Scopes", () => {
  describe("creation", () => {
    it("should create scopes from array", () => {
      const scopes = Scopes.fromArray([
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/userinfo.email",
      ]);

      expect(scopes.toArray()).toHaveLength(2);
    });

    it("should create scopes from space-separated string", () => {
      const scopes = Scopes.fromString(
        "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email"
      );

      expect(scopes.toArray()).toHaveLength(2);
    });

    it("should throw for empty array", () => {
      expect(() => Scopes.fromArray([])).toThrow("At least one scope is required");
    });

    it("should throw for empty string", () => {
      expect(() => Scopes.fromString("")).toThrow("At least one scope is required");
    });

    it("should remove duplicate scopes", () => {
      const scopes = Scopes.fromArray([
        "scope1",
        "scope2",
        "scope1", // duplicate
        "scope2", // duplicate
      ]);

      expect(scopes.toArray()).toHaveLength(2);
      expect(scopes.toArray()).toEqual(["scope1", "scope2"]);
    });

    it("should trim whitespace from scopes", () => {
      const scopes = Scopes.fromArray(["  scope1  ", " scope2 "]);

      expect(scopes.toArray()).toEqual(["scope1", "scope2"]);
    });

    it("should filter out empty strings", () => {
      const scopes = Scopes.fromString("scope1  scope2    scope3");

      expect(scopes.toArray()).toEqual(["scope1", "scope2", "scope3"]);
    });
  });

  describe("predefined scopes", () => {
    it("should create Google Calendar scopes", () => {
      const scopes = Scopes.googleCalendar();

      expect(scopes.has("https://www.googleapis.com/auth/calendar")).toBe(true);
      expect(scopes.has("https://www.googleapis.com/auth/userinfo.email")).toBe(true);
      expect(scopes.toArray()).toHaveLength(2);
    });

    it("should create Google Calendar readonly scopes", () => {
      const scopes = Scopes.googleCalendarReadonly();

      expect(scopes.has("https://www.googleapis.com/auth/calendar.readonly")).toBe(true);
    });
  });

  describe("operations", () => {
    it("should check if scope exists", () => {
      const scopes = Scopes.fromArray(["scope1", "scope2"]);

      expect(scopes.has("scope1")).toBe(true);
      expect(scopes.has("scope3")).toBe(false);
    });

    it("should add new scope", () => {
      const scopes = Scopes.fromArray(["scope1"]);
      const updated = scopes.add("scope2");

      expect(updated.toArray()).toEqual(["scope1", "scope2"]);
      expect(scopes.toArray()).toEqual(["scope1"]); // original unchanged
    });

    it("should not add duplicate scope", () => {
      const scopes = Scopes.fromArray(["scope1", "scope2"]);
      const updated = scopes.add("scope1");

      expect(updated.toArray()).toEqual(["scope1", "scope2"]);
    });

    it("should merge scopes", () => {
      const scopes1 = Scopes.fromArray(["scope1", "scope2"]);
      const scopes2 = Scopes.fromArray(["scope2", "scope3"]);
      const merged = scopes1.merge(scopes2);

      expect(merged.toArray()).toEqual(["scope1", "scope2", "scope3"]);
    });

    it("should check if contains all scopes", () => {
      const scopes = Scopes.fromArray(["scope1", "scope2", "scope3"]);

      expect(scopes.containsAll(["scope1", "scope2"])).toBe(true);
      expect(scopes.containsAll(["scope1", "scope4"])).toBe(false);
    });
  });

  describe("serialization", () => {
    it("should convert to space-separated string", () => {
      const scopes = Scopes.fromArray(["scope1", "scope2", "scope3"]);

      expect(scopes.toString()).toBe("scope1 scope2 scope3");
    });

    it("should convert to JSON array", () => {
      const scopes = Scopes.fromArray(["scope1", "scope2"]);
      const json = scopes.toJSON();

      expect(json).toEqual(["scope1", "scope2"]);
    });

    it("should restore from JSON", () => {
      const original = Scopes.fromArray(["scope1", "scope2"]);
      const json = original.toJSON();
      const restored = Scopes.fromJSON(json);

      expect(restored.toArray()).toEqual(original.toArray());
    });
  });

  describe("equality", () => {
    it("should be equal if same scopes", () => {
      const scopes1 = Scopes.fromArray(["scope1", "scope2"]);
      const scopes2 = Scopes.fromArray(["scope2", "scope1"]); // different order

      expect(scopes1.equals(scopes2)).toBe(true);
    });

    it("should not be equal if different scopes", () => {
      const scopes1 = Scopes.fromArray(["scope1", "scope2"]);
      const scopes2 = Scopes.fromArray(["scope1", "scope3"]);

      expect(scopes1.equals(scopes2)).toBe(false);
    });
  });
});
