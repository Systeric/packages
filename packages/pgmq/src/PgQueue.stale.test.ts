/**
 * DB-less unit tests for stale/retry recovery waking idle workers (#2).
 *
 * resetStaleMessages (and resetRetryableMessages) moves messages from
 * PROCESSING (or FAILED) → PENDING, but the NOTIFY trigger only fires on
 * INSERT(PENDING) and UPDATE FAILED→PENDING.  The stale-check path does a
 * raw UPDATE and the trigger never fires for the PROCESSING→PENDING case,
 * so idle workers never learn about recovered messages.
 *
 * Fix: after a reset returns count > 0, call triggerConsumption() up to
 * `concurrency` times so idle workers pick up the recovered messages.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { Pool } from "pg";
import { PgQueue } from "./PgQueue";

const fakePool = {
  connect: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  query: vi.fn(),
} as unknown as Pool;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("stale/retry recovery wakes idle workers (#2)", () => {
  it("calls triggerConsumption after stale reset returns count > 0", async () => {
    vi.useFakeTimers();

    const queue = await PgQueue.create({
      pool: fakePool,
      queueName: "test",
      autoCreate: false,
    });

    const repo = (queue as any).repository;

    // resetStaleMessages returns 3, then 0 to stop the self-perpetuating loop
    let resetCallCount = 0;
    vi.spyOn(repo, "resetStaleMessages").mockImplementation(async () => {
      resetCallCount++;
      return resetCallCount === 1 ? 3 : 0;
    });

    const triggerSpy = vi.spyOn(queue as any, "triggerConsumption").mockResolvedValue(undefined);

    (queue as any).isRunning = true;
    (queue as any).concurrency = 2;

    // Kick off the stale check
    (queue as any).scheduleStaleCheck();

    // Advance past the poll interval (default 5000ms) — one iteration
    await vi.advanceTimersByTimeAsync(6000);

    // triggerConsumption should have been called up to concurrency (2) times
    expect(triggerSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(triggerSpy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it("calls triggerConsumption after retry reset returns count > 0", async () => {
    vi.useFakeTimers();

    const queue = await PgQueue.create({
      pool: fakePool,
      queueName: "test",
      autoCreate: false,
    });

    const repo = (queue as any).repository;

    let resetCallCount = 0;
    vi.spyOn(repo, "resetRetryableMessages").mockImplementation(async () => {
      resetCallCount++;
      return resetCallCount === 1 ? 2 : 0;
    });

    const triggerSpy = vi.spyOn(queue as any, "triggerConsumption").mockResolvedValue(undefined);

    (queue as any).isRunning = true;
    (queue as any).concurrency = 3;

    (queue as any).scheduleRetryCheck();

    await vi.advanceTimersByTimeAsync(6000);

    expect(triggerSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(triggerSpy.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("does not call triggerConsumption when stale reset returns 0", async () => {
    vi.useFakeTimers();

    const queue = await PgQueue.create({
      pool: fakePool,
      queueName: "test",
      autoCreate: false,
    });

    const repo = (queue as any).repository;
    vi.spyOn(repo, "resetStaleMessages").mockResolvedValue(0);

    const triggerSpy = vi.spyOn(queue as any, "triggerConsumption").mockResolvedValue(undefined);

    (queue as any).isRunning = true;
    (queue as any).concurrency = 2;

    (queue as any).scheduleStaleCheck();

    // One poll interval
    await vi.advanceTimersByTimeAsync(6000);

    expect(triggerSpy).not.toHaveBeenCalled();
  });
});
