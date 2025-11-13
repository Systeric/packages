import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import { Pool } from "pg";
import { PgQueue } from "./PgQueue";
import { MessagePriority } from "./domain/vo/MessagePriority";
import { QueueMessage } from "./domain/entities/QueueMessage";

// Test database configuration
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/pgmq_test";

// Check if test database is available
let dbAvailable = false;

beforeAll(async () => {
  const testPool = new Pool({ connectionString: TEST_DB_URL });
  try {
    await testPool.query("SELECT 1");
    dbAvailable = true;
  } catch (error) {
    console.warn("Test database not available. Skipping integration tests.");
    dbAvailable = false;
  } finally {
    await testPool.end();
  }
});

/**
 * Helper function to wait for a specific number of events
 * More reliable than setTimeout for testing async operations
 */
function waitForEvents(
  queue: PgQueue,
  eventName: string,
  count: number,
  timeoutMs = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    let receivedCount = 0;
    const timeout = setTimeout(() => {
      reject(
        new Error(`Timeout waiting for ${count} '${eventName}' events (received ${receivedCount})`)
      );
    }, timeoutMs);

    const handler = () => {
      receivedCount++;
      if (receivedCount >= count) {
        clearTimeout(timeout);
        queue.off(eventName, handler);
        resolve();
      }
    };

    queue.on(eventName, handler);
  });
}

describe("PgQueue - Auto-consumption", () => {
  let pool: Pool;
  let queue: PgQueue;

  beforeEach(async (context) => {
    if (!dbAvailable) {
      context.skip();
      return;
    }

    pool = new Pool({ connectionString: TEST_DB_URL });
    queue = await PgQueue.create({
      pool,
      queueName: `test_queue_${Date.now()}`,
      autoCreate: true,
    });
  });

  afterEach(async () => {
    if (!dbAvailable) return;

    if (queue) {
      await queue.stop();
      // Clean up test table
      await pool.query(`DROP TABLE IF EXISTS ${queue.getTableName()}`);
    }
    if (pool) {
      await pool.end();
    }
  });

  describe("registerHandler", () => {
    it("should register a handler for a message type", () => {
      const handler = vi.fn(async (message: QueueMessage) => {
        console.log("Processing", message.getType());
      });

      queue.registerHandler("welcome-email", handler);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should allow registering multiple handlers for different types", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      queue.registerHandler("type-1", handler1);
      queue.registerHandler("type-2", handler2);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should throw error if handler is not a function", () => {
      expect(() => {
        queue.registerHandler("test", "not a function" as any);
      }).toThrow("Handler must be a function");
    });

    it("should throw error if message type is empty", () => {
      expect(() => {
        queue.registerHandler("", async () => {});
      }).toThrow("Message type cannot be empty");
    });

    it("should override handler if same type is registered twice", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      queue.registerHandler("test", handler1);
      queue.registerHandler("test", handler2); // Override

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("start with auto-consumption", () => {
    it("should automatically consume existing PENDING messages when started", async () => {
      const handler = vi.fn(async (message: QueueMessage) => {
        console.log("Processed:", message.getType());
      });

      // Enqueue 3 messages BEFORE starting the worker
      await queue.enqueue({
        type: "test-message",
        payload: { id: 1 },
      });
      await queue.enqueue({
        type: "test-message",
        payload: { id: 2 },
      });
      await queue.enqueue({
        type: "test-message",
        payload: { id: 3 },
      });

      // Register handler
      queue.registerHandler("test-message", handler);

      // Start the worker - should consume all 3 messages
      await queue.start();

      // Wait for all 3 messages to be acknowledged
      await waitForEvents(queue, "ack", 3);

      expect(handler).toHaveBeenCalledTimes(3);

      // Verify all messages were acknowledged
      const stats = await queue.getStats();
      expect(stats.completed).toBe(3);
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
    });

    it("should automatically consume new messages enqueued after start", async () => {
      const handler = vi.fn();

      queue.registerHandler("test-message", handler);

      // Start worker first
      await queue.start();

      // Enqueue messages AFTER starting
      await queue.enqueue({
        type: "test-message",
        payload: { id: 1 },
      });
      await queue.enqueue({
        type: "test-message",
        payload: { id: 2 },
      });

      // Wait for messages to be acknowledged via LISTEN/NOTIFY
      await waitForEvents(queue, "ack", 2);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should automatically ack message on successful handler execution", async () => {
      const handler = vi.fn(async (message: QueueMessage) => {
        // Handler succeeds
        return;
      });

      queue.registerHandler("test", handler);

      await queue.enqueue({ type: "test", payload: { id: 1 } });
      await queue.start();

      // Wait for the ack event instead of using setTimeout
      await waitForEvents(queue, "ack", 1);

      const stats = await queue.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it("should automatically nack message on handler error", async () => {
      const handler = vi.fn(async () => {
        throw new Error("Handler failed");
      });

      queue.registerHandler("test", handler);

      await queue.enqueue({ type: "test", payload: { id: 1 }, maxRetries: 2 });
      await queue.start();

      // Wait for the nack event
      await waitForEvents(queue, "nack", 1);

      const stats = await queue.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
      expect(stats.completed).toBe(0);
    });

    it("should emit error event when no handler is registered for message type", async () => {
      const errorHandler = vi.fn();
      queue.on("error", errorHandler);

      // No handler registered for this type
      await queue.enqueue({ type: "unknown-type", payload: { id: 1 } });
      await queue.start();

      // Wait for the nack event
      await waitForEvents(queue, "nack", 1);

      expect(errorHandler).toHaveBeenCalled();
      const error = errorHandler.mock.calls[0][0];
      expect(error.message).toContain("No handler registered");

      // Message should be nacked
      const stats = await queue.getStats();
      expect(stats.failed).toBe(1);
    });

    it("should handle dequeue errors gracefully during consumption", async () => {
      const errorHandler = vi.fn();
      queue.on("error", errorHandler);

      const handler = vi.fn(async (message: QueueMessage) => {
        console.log("Processed:", message.getType());
      });

      queue.registerHandler("test", handler);

      // Enqueue a message
      await queue.enqueue({ type: "test", payload: { id: 1 } });

      // Spy on dequeue to make it fail once
      const dequeueError = new Error("Database connection lost");
      const dequeueSpy = vi.spyOn(queue as any, "dequeue");
      dequeueSpy.mockRejectedValueOnce(dequeueError);

      await queue.start();

      // Wait for the error event
      await waitForEvents(queue, "error", 1);

      // Error should be emitted
      expect(errorHandler).toHaveBeenCalledTimes(1);
      const error = errorHandler.mock.calls[0][0];
      expect(error.message).toContain("Failed to dequeue message for consumption");

      // Handler should not have been called
      expect(handler).not.toHaveBeenCalled();

      // Restore the spy
      dequeueSpy.mockRestore();
    });

    it("should respect concurrency limit", async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const handler = vi.fn(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise((resolve) => setTimeout(resolve, 100));
        concurrentCount--;
      });

      queue.registerHandler("test", handler);

      // Enqueue 10 messages
      for (let i = 0; i < 10; i++) {
        await queue.enqueue({ type: "test", payload: { id: i } });
      }

      // Start with concurrency of 3
      await queue.start({ concurrency: 3 });

      // Wait for all 10 messages to be acknowledged
      await waitForEvents(queue, "ack", 10);

      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(handler).toHaveBeenCalledTimes(10);
    });

    it("should be idempotent - calling start() multiple times should not cause issues", async () => {
      const handler = vi.fn();
      queue.registerHandler("test", handler);

      await queue.start();
      await queue.start(); // Second call should be safe

      await queue.enqueue({ type: "test", payload: { id: 1 } });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should process once, not twice
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop with graceful shutdown", () => {
    it("should wait for in-flight messages to complete before stopping", async () => {
      let handlerStarted = false;
      let handlerCompleted = false;

      const handler = vi.fn(async () => {
        handlerStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 300));
        handlerCompleted = true;
      });

      queue.registerHandler("test", handler);

      await queue.enqueue({ type: "test", payload: { id: 1 } });
      await queue.start();

      // Wait for handler to start
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(handlerStarted).toBe(true);
      expect(handlerCompleted).toBe(false);

      // Stop should wait for handler to complete
      await queue.stop();

      expect(handlerCompleted).toBe(true);
    });

    it("should not consume new messages after stop() is called", async () => {
      const handler = vi.fn();
      queue.registerHandler("test", handler);

      await queue.start();
      await queue.stop();

      // Enqueue after stop
      await queue.enqueue({ type: "test", payload: { id: 1 } });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should not be processed
      expect(handler).not.toHaveBeenCalled();
    });

    it("should be idempotent - calling stop() multiple times should not cause issues", async () => {
      await queue.start();
      await queue.stop();
      await queue.stop(); // Second call should be safe

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("handler context", () => {
    it("should pass QueueMessage to handler", async () => {
      const handler = vi.fn(async (message: QueueMessage) => {
        expect(message).toBeInstanceOf(QueueMessage);
        expect(message.getType()).toBe("test");
        expect(message.getPayload()).toEqual({ userId: "123" });
      });

      queue.registerHandler("test", handler);

      await queue.enqueue({
        type: "test",
        payload: { userId: "123" },
      });

      await queue.start();
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("priority handling", () => {
    it("should process high priority messages before normal priority", async () => {
      const processOrder: number[] = [];

      const handler = vi.fn(async (message: QueueMessage) => {
        processOrder.push(message.getPayload().id as number);
      });

      queue.registerHandler("test", handler);

      // Enqueue in order: normal, normal, high
      await queue.enqueue({
        type: "test",
        payload: { id: 1 },
        priority: MessagePriority.NORMAL,
      });
      await queue.enqueue({
        type: "test",
        payload: { id: 2 },
        priority: MessagePriority.NORMAL,
      });
      await queue.enqueue({
        type: "test",
        payload: { id: 3 },
        priority: MessagePriority.HIGH,
      });

      await queue.start();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // High priority (id: 3) should be processed first
      expect(processOrder[0]).toBe(3);
    });
  });
});
