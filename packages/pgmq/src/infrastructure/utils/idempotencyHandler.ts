import { Pool, PoolClient, DatabaseError as PgDatabaseError } from "pg";
import {
  IdempotencyError,
  IdempotencyKeyInProcessError,
  IdempotencyClaimError,
  UniqueConstraintError,
  ConnectionError,
} from "../../domain/errors/PgQueueErrors";

export interface IdempotencyOptions {
  /**
   * Unique idempotency key for this operation
   * Recommended format: `{operation}:{entity_id}:{timestamp}`
   * Example: "process_payment:user_123:1234567890"
   */
  idempotencyKey: string;

  /**
   * TTL for idempotency keys in seconds (default: 86400 = 24 hours)
   * After this time, the same key can be reused
   */
  ttlSeconds?: number;

  /**
   * Optional PostgreSQL client for transactions
   * If provided, idempotency check will be part of the transaction
   */
  client?: PoolClient;
}

export interface IdempotencyResult<T> {
  /**
   * Whether this is the first time this operation is being executed
   */
  isFirstExecution: boolean;

  /**
   * Result from previous execution (if exists)
   * Only present if isFirstExecution = false
   */
  cachedResult?: T;
}

/**
 * Idempotency handler using PostgreSQL advisory locks and result caching
 *
 * Prevents duplicate execution of operations by:
 * 1. Checking if operation with same idempotency key was already executed
 * 2. If yes, returns cached result
 * 3. If no, executes operation and caches result
 *
 * Usage:
 * ```typescript
 * const handler = new IdempotencyHandler(pool, 'idempotency_keys');
 *
 * const result = await handler.execute(
 *   { idempotencyKey: 'charge:order_123:1234567890' },
 *   async () => {
 *     // Your business logic here
 *     const charge = await stripe.charges.create(...);
 *     return charge;
 *   }
 * );
 *
 * if (result.isFirstExecution) {
 *   console.log('Charge created:', result.cachedResult);
 * } else {
 *   console.log('Duplicate request, returning cached:', result.cachedResult);
 * }
 * ```
 */
export class IdempotencyHandler {
  private readonly pool: Pool;
  private readonly tableName: string;

  constructor(pool: Pool, tableName: string = "idempotency_keys") {
    this.pool = pool;
    this.tableName = tableName;
  }

  /**
   * Initialize the idempotency table
   * Call this once during application startup
   */
  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        idempotency_key VARCHAR(255) PRIMARY KEY,
        result JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires
      ON ${this.tableName}(expires_at);
    `);
  }

  /**
   * Execute an operation with idempotency guarantees
   *
   * @param options - Idempotency configuration
   * @param operation - Function to execute (only runs once per key)
   * @returns Result with isFirstExecution flag and cached/new result
   */
  async execute<T>(
    options: IdempotencyOptions,
    operation: () => Promise<T>
  ): Promise<IdempotencyResult<T>> {
    const { idempotencyKey, ttlSeconds = 86400, client } = options;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const dbClient = client || this.pool;

    // Atomically claim the idempotency key BEFORE executing operation
    // Use INSERT to claim ownership - if it fails, another process has already claimed it
    try {
      await dbClient.query(
        `INSERT INTO ${this.tableName} (idempotency_key, result, expires_at)
         VALUES ($1, NULL, $2)`,
        [idempotencyKey, expiresAt]
      );

      // We successfully claimed the key - execute the operation
      const result = await operation();

      // Update with the actual result
      await dbClient.query(
        `UPDATE ${this.tableName}
         SET result = $1
         WHERE idempotency_key = $2`,
        [JSON.stringify(result), idempotencyKey]
      );

      return {
        isFirstExecution: true,
        cachedResult: result,
      };
    } catch (error) {
      const pgError = error as PgDatabaseError;

      // Check if this is a unique constraint violation (code 23505)
      // If not, it's a different error (e.g., connection error) - re-throw immediately
      if (pgError.code !== "23505") {
        throw new IdempotencyClaimError(idempotencyKey, pgError);
      }

      // INSERT failed due to unique constraint - key already exists
      // Another process is handling or has handled this operation
      try {
        const checkResult = await dbClient.query(
          `SELECT result FROM ${this.tableName}
           WHERE idempotency_key = $1 AND expires_at > NOW()`,
          [idempotencyKey]
        );

        if (checkResult.rows.length > 0) {
          const row = checkResult.rows[0] as { result: T | null };
          // If result is null, the other process is still executing
          // Wait and retry or return a conflict/retry response
          if (row.result === null) {
            // Optionally implement retry logic with exponential backoff here
            throw new IdempotencyKeyInProcessError(idempotencyKey);
          }

          return {
            isFirstExecution: false,
            cachedResult: row.result,
          };
        }

        // Key expired between INSERT and SELECT - treat as unique constraint error
        throw new UniqueConstraintError(
          `Idempotency key "${idempotencyKey}" exists but has expired`,
          pgError
        );
      } catch (selectError) {
        // If SELECT query fails, wrap it as a connection error
        if (selectError instanceof IdempotencyError) {
          throw selectError;
        }
        throw new ConnectionError(
          "Failed to query idempotency key after claim failure",
          selectError as Error
        );
      }
    }
  }

  /**
   * Clean up expired idempotency keys
   * Should be called periodically (e.g., via cron job)
   */
  async cleanup(): Promise<number> {
    const result = await this.pool.query(`DELETE FROM ${this.tableName} WHERE expires_at <= NOW()`);
    return result.rowCount || 0;
  }

  /**
   * Manually invalidate an idempotency key
   * Use with caution - only for administrative purposes
   */
  async invalidate(idempotencyKey: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE idempotency_key = $1`,
      [idempotencyKey]
    );
    return (result.rowCount || 0) > 0;
  }
}
