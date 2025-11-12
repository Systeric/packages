import { describe, it, expect } from "vitest";
import { QueueMessage } from "./QueueMessage";
import { MessageId } from "../vo/MessageId";
import { MessageStatus } from "../vo/MessageStatus";
import { MessagePriority } from "../vo/MessagePriority";

describe("QueueMessage", () => {
  describe("create", () => {
    it("should create a new message with PENDING status", () => {
      const message = QueueMessage.create({
        type: "email.welcome",
        payload: { userId: "123", email: "user@example.com" },
        priority: MessagePriority.HIGH,
        maxRetries: 3,
      });

      expect(message.getId()).toBeInstanceOf(MessageId);
      expect(message.getType()).toBe("email.welcome");
      expect(message.getPayload()).toEqual({
        userId: "123",
        email: "user@example.com",
      });
      expect(message.getStatus().isPending()).toBe(true);
      expect(message.getPriority().equals(MessagePriority.HIGH)).toBe(true);
      expect(message.getRetryCount()).toBe(0);
      expect(message.getMaxRetries()).toBe(3);
      expect(message.getCreatedAt()).toBeInstanceOf(Date);
      expect(message.getUpdatedAt()).toBeInstanceOf(Date);
    });

    it("should use default priority (NORMAL) if not provided", () => {
      const message = QueueMessage.create({
        type: "email.welcome",
        payload: { test: true },
      });

      expect(message.getPriority().equals(MessagePriority.NORMAL)).toBe(true);
    });

    it("should use default maxRetries (3) if not provided", () => {
      const message = QueueMessage.create({
        type: "email.welcome",
        payload: { test: true },
      });

      expect(message.getMaxRetries()).toBe(3);
    });

    it("should throw error if type is empty", () => {
      expect(() =>
        QueueMessage.create({
          type: "",
          payload: { test: true },
        })
      ).toThrow("Message type cannot be empty");
    });

    it("should throw error if type is too long", () => {
      expect(() =>
        QueueMessage.create({
          type: "a".repeat(256),
          payload: { test: true },
        })
      ).toThrow("Message type cannot exceed 255 characters");
    });

    it("should throw error if payload is null", () => {
      expect(() =>
        QueueMessage.create({
          type: "test",
          payload: null as any,
        })
      ).toThrow("Payload cannot be null or undefined");
    });

    it("should throw error if maxRetries is less than 1", () => {
      expect(() =>
        QueueMessage.create({
          type: "test",
          payload: { test: true },
          maxRetries: 0,
        })
      ).toThrow("Max retries must be at least 1");
    });
  });

  describe("reconstitute", () => {
    it("should recreate message from database data", () => {
      const id = MessageId.generate();
      const now = new Date();

      const message = QueueMessage.reconstitute({
        id,
        type: "email.welcome",
        payload: { userId: "123" },
        status: MessageStatus.PROCESSING,
        priority: MessagePriority.URGENT,
        retryCount: 2,
        maxRetries: 5,
        lastError: "Connection timeout",
        nextRetryAt: new Date(Date.now() + 1000),
        createdAt: now,
        updatedAt: now,
      });

      expect(message.getId().equals(id)).toBe(true);
      expect(message.getType()).toBe("email.welcome");
      expect(message.getStatus().isProcessing()).toBe(true);
      expect(message.getPriority().equals(MessagePriority.URGENT)).toBe(true);
      expect(message.getRetryCount()).toBe(2);
      expect(message.getMaxRetries()).toBe(5);
      expect(message.getLastError()).toBe("Connection timeout");
      expect(message.getNextRetryAt()).toBeInstanceOf(Date);
    });
  });

  describe("markAsProcessing", () => {
    it("should change status from PENDING to PROCESSING", async () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      // Small delay to ensure updatedAt is different
      await new Promise((resolve) => setTimeout(resolve, 1));

      message.markAsProcessing();

      expect(message.getStatus().isProcessing()).toBe(true);
      expect(message.getUpdatedAt().getTime()).toBeGreaterThanOrEqual(
        message.getCreatedAt().getTime()
      );
    });

    it("should throw error if not in PENDING status", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      message.markAsProcessing();

      expect(() => message.markAsProcessing()).toThrow(
        "Cannot mark as processing: message is not pending"
      );
    });
  });

  describe("markAsCompleted", () => {
    it("should change status from PROCESSING to COMPLETED", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      message.markAsProcessing();
      message.markAsCompleted();

      expect(message.getStatus().isCompleted()).toBe(true);
    });

    it("should throw error if not in PROCESSING status", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      expect(() => message.markAsCompleted()).toThrow(
        "Cannot mark as completed: message is not processing"
      );
    });
  });

  describe("markAsFailed", () => {
    it("should change status to FAILED and increment retry count", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
        maxRetries: 3,
      });

      message.markAsProcessing();
      message.markAsFailed(new Error("Test error"));

      expect(message.getStatus().isFailed()).toBe(true);
      expect(message.getRetryCount()).toBe(1);
      expect(message.getLastError()).toBe("Test error");
      expect(message.getNextRetryAt()).toBeInstanceOf(Date);
    });

    it("should use exponential backoff for retry timing", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
        maxRetries: 5,
      });

      // First retry: 1 second
      message.markAsProcessing();
      const before1 = Date.now();
      message.markAsFailed(new Error("Error 1"));
      const nextRetry1 = message.getNextRetryAt()!.getTime();
      expect(nextRetry1).toBeGreaterThanOrEqual(before1 + 1000);
      expect(nextRetry1).toBeLessThanOrEqual(before1 + 1500);

      // Reset to pending for next attempt
      message.resetToPending();

      // Second retry: 2 seconds
      message.markAsProcessing();
      const before2 = Date.now();
      message.markAsFailed(new Error("Error 2"));
      const nextRetry2 = message.getNextRetryAt()!.getTime();
      expect(nextRetry2).toBeGreaterThanOrEqual(before2 + 2000);
      expect(nextRetry2).toBeLessThanOrEqual(before2 + 2500);
    });

    it("should mark as DEAD_LETTER when retry count exceeds max retries", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
        maxRetries: 2,
      });

      // Attempt 1
      message.markAsProcessing();
      message.markAsFailed(new Error("Error 1"));
      expect(message.getRetryCount()).toBe(1);
      expect(message.getStatus().isFailed()).toBe(true);

      // Attempt 2
      message.resetToPending();
      message.markAsProcessing();
      message.markAsFailed(new Error("Error 2"));
      expect(message.getRetryCount()).toBe(2);
      expect(message.getStatus().isFailed()).toBe(true);

      // Attempt 3 - should become DEAD_LETTER
      message.resetToPending();
      message.markAsProcessing();
      message.markAsFailed(new Error("Error 3"));
      expect(message.getRetryCount()).toBe(3);
      expect(message.getStatus().isDeadLetter()).toBe(true);
      expect(message.getNextRetryAt()).toBeNull();
    });

    it("should throw error if not in PROCESSING status", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      expect(() => message.markAsFailed(new Error("test"))).toThrow(
        "Cannot mark as failed: message is not processing"
      );
    });
  });

  describe("resetToPending", () => {
    it("should reset FAILED message back to PENDING", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      message.markAsProcessing();
      message.markAsFailed(new Error("test"));

      message.resetToPending();

      expect(message.getStatus().isPending()).toBe(true);
      expect(message.getNextRetryAt()).toBeNull();
    });

    it("should throw error if not in FAILED status", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      expect(() => message.resetToPending()).toThrow(
        "Cannot reset to pending: message is not failed"
      );
    });
  });

  describe("retry", () => {
    it("should reset retry count and status to PENDING", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
        maxRetries: 2,
      });

      // Fail twice
      message.markAsProcessing();
      message.markAsFailed(new Error("error 1"));
      message.resetToPending();
      message.markAsProcessing();
      message.markAsFailed(new Error("error 2"));

      expect(message.getRetryCount()).toBe(2);

      // Manual retry - resets retry count
      message.retry();

      expect(message.getStatus().isPending()).toBe(true);
      expect(message.getRetryCount()).toBe(0);
      expect(message.getNextRetryAt()).toBeNull();
      expect(message.getLastError()).toBeNull();
    });

    it("should allow retrying DEAD_LETTER messages", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
        maxRetries: 1,
      });

      // Fail until DEAD_LETTER
      message.markAsProcessing();
      message.markAsFailed(new Error("error 1"));
      message.resetToPending();
      message.markAsProcessing();
      message.markAsFailed(new Error("error 2"));

      expect(message.getStatus().isDeadLetter()).toBe(true);
      expect(message.getRetryCount()).toBe(2);

      // Manual retry - bypasses FAILED check
      message.retry();

      expect(message.getStatus().isPending()).toBe(true);
      expect(message.getRetryCount()).toBe(0);
    });
  });

  describe("isStale", () => {
    it("should return true if PROCESSING for longer than visibility timeout", () => {
      const message = QueueMessage.reconstitute({
        id: MessageId.generate(),
        type: "test",
        payload: { test: true },
        status: MessageStatus.PROCESSING,
        priority: MessagePriority.NORMAL,
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        nextRetryAt: null,
        createdAt: new Date(),
        updatedAt: new Date(Date.now() - 65000), // 65 seconds ago
      });

      expect(message.isStale(60000)).toBe(true); // 60s timeout
    });

    it("should return false if PROCESSING within visibility timeout", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      message.markAsProcessing();

      expect(message.isStale(60000)).toBe(false);
    });

    it("should return false if not in PROCESSING status", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      expect(message.isStale(60000)).toBe(false);
    });
  });

  describe("isReadyForRetry", () => {
    it("should return true if FAILED and nextRetryAt has passed", () => {
      const message = QueueMessage.reconstitute({
        id: MessageId.generate(),
        type: "test",
        payload: { test: true },
        status: MessageStatus.FAILED,
        priority: MessagePriority.NORMAL,
        retryCount: 1,
        maxRetries: 3,
        lastError: "error",
        nextRetryAt: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(message.isReadyForRetry()).toBe(true);
    });

    it("should return false if FAILED but nextRetryAt is in future", () => {
      const message = QueueMessage.reconstitute({
        id: MessageId.generate(),
        type: "test",
        payload: { test: true },
        status: MessageStatus.FAILED,
        priority: MessagePriority.NORMAL,
        retryCount: 1,
        maxRetries: 3,
        lastError: "error",
        nextRetryAt: new Date(Date.now() + 5000), // 5 seconds from now
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(message.isReadyForRetry()).toBe(false);
    });

    it("should return false if not in FAILED status", () => {
      const message = QueueMessage.create({
        type: "test",
        payload: { test: true },
      });

      expect(message.isReadyForRetry()).toBe(false);
    });
  });
});
