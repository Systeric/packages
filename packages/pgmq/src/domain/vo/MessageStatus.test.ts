import { describe, it, expect } from "vitest";
import { MessageStatus } from "./MessageStatus";

describe("MessageStatus", () => {
  describe("constants", () => {
    it("should have PENDING status", () => {
      expect(MessageStatus.PENDING.toString()).toBe("PENDING");
    });

    it("should have PROCESSING status", () => {
      expect(MessageStatus.PROCESSING.toString()).toBe("PROCESSING");
    });

    it("should have COMPLETED status", () => {
      expect(MessageStatus.COMPLETED.toString()).toBe("COMPLETED");
    });

    it("should have FAILED status", () => {
      expect(MessageStatus.FAILED.toString()).toBe("FAILED");
    });

    it("should have DEAD_LETTER status", () => {
      expect(MessageStatus.DEAD_LETTER.toString()).toBe("DEAD_LETTER");
    });
  });

  describe("fromString", () => {
    it("should create MessageStatus from valid status string", () => {
      const status = MessageStatus.fromString("PENDING");
      expect(status.toString()).toBe("PENDING");
    });

    it("should throw error for invalid status", () => {
      expect(() => MessageStatus.fromString("INVALID")).toThrow("Invalid message status");
    });

    it("should throw error for empty string", () => {
      expect(() => MessageStatus.fromString("")).toThrow("Invalid message status");
    });

    it("should be case-sensitive", () => {
      expect(() => MessageStatus.fromString("pending")).toThrow();
    });
  });

  describe("type checks", () => {
    it("should identify PENDING status", () => {
      const status = MessageStatus.PENDING;
      expect(status.isPending()).toBe(true);
      expect(status.isProcessing()).toBe(false);
      expect(status.isCompleted()).toBe(false);
      expect(status.isFailed()).toBe(false);
      expect(status.isDeadLetter()).toBe(false);
    });

    it("should identify PROCESSING status", () => {
      const status = MessageStatus.PROCESSING;
      expect(status.isPending()).toBe(false);
      expect(status.isProcessing()).toBe(true);
      expect(status.isCompleted()).toBe(false);
      expect(status.isFailed()).toBe(false);
      expect(status.isDeadLetter()).toBe(false);
    });

    it("should identify COMPLETED status", () => {
      const status = MessageStatus.COMPLETED;
      expect(status.isPending()).toBe(false);
      expect(status.isProcessing()).toBe(false);
      expect(status.isCompleted()).toBe(true);
      expect(status.isFailed()).toBe(false);
      expect(status.isDeadLetter()).toBe(false);
    });

    it("should identify FAILED status", () => {
      const status = MessageStatus.FAILED;
      expect(status.isPending()).toBe(false);
      expect(status.isProcessing()).toBe(false);
      expect(status.isCompleted()).toBe(false);
      expect(status.isFailed()).toBe(true);
      expect(status.isDeadLetter()).toBe(false);
    });

    it("should identify DEAD_LETTER status", () => {
      const status = MessageStatus.DEAD_LETTER;
      expect(status.isPending()).toBe(false);
      expect(status.isProcessing()).toBe(false);
      expect(status.isCompleted()).toBe(false);
      expect(status.isFailed()).toBe(false);
      expect(status.isDeadLetter()).toBe(true);
    });
  });

  describe("equals", () => {
    it("should return true for same status", () => {
      const status1 = MessageStatus.PENDING;
      const status2 = MessageStatus.fromString("PENDING");
      expect(status1.equals(status2)).toBe(true);
    });

    it("should return false for different status", () => {
      const status1 = MessageStatus.PENDING;
      const status2 = MessageStatus.PROCESSING;
      expect(status1.equals(status2)).toBe(false);
    });
  });
});
