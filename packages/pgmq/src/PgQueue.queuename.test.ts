/**
 * DB-less unit tests for queue name length validation (#4).
 *
 * The longest Postgres identifier derived from a queue name is:
 *   systeric_pgqueue_{q}_notify_trigger  (32 + len(q) bytes)
 * Postgres truncates identifiers at 63 bytes, so len(q) must be ≤ 31.
 */
import { describe, it, expect } from "vitest";
import { Pool } from "pg";
import { PgQueue } from "./PgQueue";
import { InvalidQueueConfigError } from "./domain/errors";

const fakePool = {
  connect: vi.fn(),
  end: vi.fn(),
  on: vi.fn(),
  query: vi.fn(),
} as unknown as Pool;

import { vi } from "vitest";

describe("queue name length validation (#4)", () => {
  it("rejects a 32-character queue name with InvalidQueueConfigError", async () => {
    const longName = "a".repeat(32); // 32 chars — too long
    await expect(
      PgQueue.create({ pool: fakePool, queueName: longName, autoCreate: false })
    ).rejects.toThrow(InvalidQueueConfigError);
  });

  it("accepts a 31-character queue name", async () => {
    const maxName = "a".repeat(31); // 31 chars — at the limit
    await expect(
      PgQueue.create({ pool: fakePool, queueName: maxName, autoCreate: false })
    ).resolves.toBeDefined();
  });

  it("generateMigration rejects a 32-character queue name with InvalidQueueConfigError", () => {
    const longName = "a".repeat(32);
    expect(() => PgQueue.generateMigration(longName)).toThrow(InvalidQueueConfigError);
  });

  it("generateMigration accepts a 31-character queue name", () => {
    const maxName = "a".repeat(31);
    expect(() => PgQueue.generateMigration(maxName)).not.toThrow();
  });
});
