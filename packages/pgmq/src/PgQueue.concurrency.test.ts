/**
 * DB-less unit tests for PgQueue concurrency race fix (#1).
 *
 * Verifies that triggerConsumption never spawns more concurrent workers
 * than the configured concurrency limit, even when many notifications arrive
 * simultaneously (before any worker has incremented activeWorkers).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { Pool } from "pg";
import { PgQueue } from "./PgQueue";
import { QueueMessage } from "./domain/entities/QueueMessage";
import { MessageId } from "./domain/vo/MessageId";

// Minimal fake Pool that satisfies the type without touching a database
const fakePool = {
  connect: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  query: vi.fn(),
} as unknown as Pool;

/** Build a minimal QueueMessage stub */
function makeMessage(type = "test"): QueueMessage {
  return QueueMessage.create({ type, payload: {} });
}

/** Build a MessageId stub */
function makeId(): MessageId {
  return MessageId.generate();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("triggerConsumption concurrency gate (#1)", () => {
  it("never exceeds configured concurrency even when many triggers fire simultaneously", async () => {
    const concurrency = 2;

    // Create queue without touching DB (autoCreate: false)
    const queue = await PgQueue.create({
      pool: fakePool,
      queueName: "test",
      autoCreate: false,
    });

    // Track the high-water mark of concurrent executions
    let concurrent = 0;
    let maxConcurrent = 0;

    // Dequeue returns a message that "takes time" to process (long handler)
    const dequeueStub = vi.spyOn(queue, "dequeue").mockImplementation(async () => {
      // Small yield to simulate async work
      await new Promise((resolve) => setImmediate(resolve));
      return makeMessage();
    });

    // Ack resolves immediately
    vi.spyOn(queue, "ack").mockResolvedValue(undefined);

    // Handler increments concurrent count, records max, then decrements
    queue.registerHandler("test", async (_msg) => {
      concurrent++;
      if (concurrent > maxConcurrent) maxConcurrent = concurrent;
      // Simulate some async work
      await new Promise((resolve) => setImmediate(resolve));
      concurrent--;
    });

    // We need to call start() but it tries to pool.connect() for LISTEN
    // Stub start internals instead: set isRunning and concurrency via internals,
    // then call triggerConsumption directly
    (queue as any).isRunning = true;
    (queue as any).concurrency = concurrency;

    // Suppress error events so vitest doesn't report them as unhandled errors.
    // These fire from subsequent triggerConsumption calls via the finally chain
    // once the dequeue stub has been restored.
    queue.on("error", () => {});

    // Fire 5 triggers simultaneously — without the fix they all pass the gate
    const triggers = [
      (queue as any).triggerConsumption(),
      (queue as any).triggerConsumption(),
      (queue as any).triggerConsumption(),
      (queue as any).triggerConsumption(),
      (queue as any).triggerConsumption(),
    ];

    await Promise.all(triggers);
    // Drain any remaining in-flight
    await Promise.all(Array.from((queue as any).inflightMessages));

    dequeueStub.mockRestore();

    expect(maxConcurrent).toBeLessThanOrEqual(concurrency);
  });
});
