import { describe, it, expect } from "vitest";
import { MessagePriority } from "./MessagePriority";

describe("MessagePriority", () => {
  describe("constants", () => {
    it("should have URGENT priority with value 1", () => {
      expect(MessagePriority.URGENT.getValue()).toBe(1);
    });

    it("should have HIGH priority with value 3", () => {
      expect(MessagePriority.HIGH.getValue()).toBe(3);
    });

    it("should have NORMAL priority with value 5", () => {
      expect(MessagePriority.NORMAL.getValue()).toBe(5);
    });

    it("should have LOW priority with value 8", () => {
      expect(MessagePriority.LOW.getValue()).toBe(8);
    });
  });

  describe("create", () => {
    it("should create priority with valid value", () => {
      const priority = MessagePriority.create(7);
      expect(priority.getValue()).toBe(7);
    });

    it("should throw error for priority < 1", () => {
      expect(() => MessagePriority.create(0)).toThrow("Invalid priority");
    });

    it("should throw error for priority > 10", () => {
      expect(() => MessagePriority.create(11)).toThrow("Invalid priority");
    });

    it("should throw error for negative priority", () => {
      expect(() => MessagePriority.create(-1)).toThrow();
    });

    it("should accept boundary values 1 and 10", () => {
      expect(MessagePriority.create(1).getValue()).toBe(1);
      expect(MessagePriority.create(10).getValue()).toBe(10);
    });
  });

  describe("fromNumber", () => {
    it("should create priority from number", () => {
      const priority = MessagePriority.fromNumber(5);
      expect(priority.getValue()).toBe(5);
    });

    it("should throw error for invalid number", () => {
      expect(() => MessagePriority.fromNumber(15)).toThrow();
    });
  });

  describe("equals", () => {
    it("should return true for same priority value", () => {
      const p1 = MessagePriority.create(5);
      const p2 = MessagePriority.create(5);
      expect(p1.equals(p2)).toBe(true);
    });

    it("should return false for different priority values", () => {
      const p1 = MessagePriority.create(1);
      const p2 = MessagePriority.create(10);
      expect(p1.equals(p2)).toBe(false);
    });

    it("should work with constant priorities", () => {
      const p1 = MessagePriority.NORMAL;
      const p2 = MessagePriority.create(5);
      expect(p1.equals(p2)).toBe(true);
    });
  });

  describe("compareTo", () => {
    it("should return negative for lower priority (higher number)", () => {
      const high = MessagePriority.create(1);
      const low = MessagePriority.create(10);
      expect(high.compareTo(low)).toBeLessThan(0);
    });

    it("should return positive for higher priority (lower number)", () => {
      const low = MessagePriority.create(10);
      const high = MessagePriority.create(1);
      expect(low.compareTo(high)).toBeGreaterThan(0);
    });

    it("should return 0 for equal priorities", () => {
      const p1 = MessagePriority.create(5);
      const p2 = MessagePriority.create(5);
      expect(p1.compareTo(p2)).toBe(0);
    });

    it("should sort priorities correctly", () => {
      const priorities = [
        MessagePriority.LOW,
        MessagePriority.URGENT,
        MessagePriority.NORMAL,
        MessagePriority.HIGH,
      ];

      priorities.sort((a, b) => a.compareTo(b));

      expect(priorities[0]).toBe(MessagePriority.URGENT);
      expect(priorities[1]).toBe(MessagePriority.HIGH);
      expect(priorities[2]).toBe(MessagePriority.NORMAL);
      expect(priorities[3]).toBe(MessagePriority.LOW);
    });
  });
});
