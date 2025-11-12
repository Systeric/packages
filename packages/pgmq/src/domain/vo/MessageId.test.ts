import { describe, it, expect } from "vitest";
import { MessageId } from "./MessageId";

describe("MessageId", () => {
  describe("generate", () => {
    it("should generate a valid UUID v4", () => {
      const id = MessageId.generate();
      const value = id.getValue();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should generate unique IDs", () => {
      const id1 = MessageId.generate();
      const id2 = MessageId.generate();

      expect(id1.getValue()).not.toBe(id2.getValue());
    });
  });

  describe("fromString", () => {
    it("should create MessageId from valid UUID string", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const id = MessageId.fromString(uuid);

      expect(id.getValue()).toBe(uuid);
    });

    it("should throw error for invalid UUID format", () => {
      expect(() => MessageId.fromString("invalid-uuid")).toThrow("Invalid message ID format");
    });

    it("should throw error for empty string", () => {
      expect(() => MessageId.fromString("")).toThrow("Invalid message ID format");
    });

    it("should throw error for non-UUID string", () => {
      expect(() => MessageId.fromString("12345")).toThrow("Invalid message ID format");
    });
  });

  describe("equals", () => {
    it("should return true for same UUID value", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const id1 = MessageId.fromString(uuid);
      const id2 = MessageId.fromString(uuid);

      expect(id1.equals(id2)).toBe(true);
    });

    it("should return false for different UUID values", () => {
      const id1 = MessageId.fromString("123e4567-e89b-12d3-a456-426614174000");
      const id2 = MessageId.fromString("223e4567-e89b-12d3-a456-426614174000");

      expect(id1.equals(id2)).toBe(false);
    });
  });

  describe("toString", () => {
    it("should return the UUID string", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const id = MessageId.fromString(uuid);

      expect(id.toString()).toBe(uuid);
    });
  });
});
