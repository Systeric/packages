import { Pool, PoolClient } from "pg";
import EventEmitter from "events";
import { type Notification } from "pg";
import { QueueConfig } from "./domain/vo/QueueConfig";
import { QueueMessage, QueueMessageProps } from "./domain/entities/QueueMessage";
import { MessageId } from "./domain/vo/MessageId";
import { MessageStatus } from "./domain/vo/MessageStatus";
import { PostgresQueueRepository } from "./infrastructure/PostgresQueueRepository";
import { FindOptions } from "./application/ports/QueueRepository";
import {
  getTableName,
  generateTableSQL,
  generateIndexesSQL,
  generateNotifyTriggerSQL,
  generateMigrationSQL,
} from "./infrastructure/utils/sqlGenerators";
import {
  DatabaseError,
  TransactionError,
  BackgroundJobError,
  NoHandlerRegisteredError,
  HandlerExecutionError,
} from "./domain/errors/PgQueueErrors";

export interface PgQueueConfig {
  /**
   * PostgreSQL connection string
   * Example: "postgresql://user:password@localhost:5432/mydb"
   * Note: Ignored if pool is provided
   */
  connectionString?: string;

  /**
   * Shared PostgreSQL connection pool (recommended for production)
   * If provided, this pool will be shared across all queues in your application.
   * The pool will NOT be closed when stop() is called.
   * If not provided, a new pool will be created from connectionString.
   */
  pool?: Pool;

  /**
   * Queue name (like Kafka topic)
   * Table will be created as: systeric_pgqueue_{queueName}
   * Example: "emails" -> "systeric_pgqueue_emails"
   */
  queueName: string;

  /**
   * Auto-create table on initialization (default: true)
   * Set to false if you want to run migrations manually
   */
  autoCreate?: boolean;

  /**
   * How long a message stays in PROCESSING before being reset (default: 300000ms = 5 minutes)
   */
  visibilityTimeoutMs?: number;

  /**
   * How often to check for stale/retryable messages (default: 60000ms = 1 minute)
   */
  pollIntervalMs?: number;

  /**
   * Default max retries for messages (default: 3)
   */
  maxRetries?: number;
}

/**
 * Transaction context with query and enqueue support
 */
export interface TransactionContext {
  query: PoolClient["query"];
  enqueue: (props: QueueMessageProps) => Promise<MessageId>;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: QueueMessage) => Promise<void>;

/**
 * Start options for queue worker
 */
export interface StartOptions {
  /**
   * Maximum number of messages to process concurrently (default: 1)
   */
  concurrency?: number;
}

/**
 * PgQueue - PostgreSQL-based message queue
 *
 * Each queue is like a Kafka topic - it has its own table:
 * - Queue "emails" -> Table "systeric_pgqueue_emails"
 * - Queue "notifications" -> Table "systeric_pgqueue_notifications"
 *
 * Features:
 * - Auto table creation (idempotent)
 * - LISTEN/NOTIFY for instant delivery
 * - FOR UPDATE SKIP LOCKED for work-stealing
 * - DLQ (Dead Letter Queue) support
 * - Retry logic with exponential backoff
 *
 * Note: When queue is closed, table is NOT deleted (data persists)
 */
export class PgQueue extends EventEmitter {
  private readonly pool: Pool;
  private readonly repository: PostgresQueueRepository;
  private readonly config: QueueConfig;
  private readonly tableName: string;
  private readonly channelName: string;
  private readonly ownsPool: boolean; // Track if we created the pool
  private listenerClient: PoolClient | null = null;
  private staleCheckTimeout: NodeJS.Timeout | null = null;
  private retryCheckTimeout: NodeJS.Timeout | null = null;
  private isRunning = false;
  private staleCheckBackoffMs = 0; // Exponential backoff tracking
  private retryCheckBackoffMs = 0; // Exponential backoff tracking
  private readonly maxBackoffMs = 60000; // Max 60 seconds backoff

  // Auto-consumption fields
  private readonly handlers: Map<string, MessageHandler> = new Map();
  private concurrency = 1; // Max concurrent workers
  private activeWorkers = 0; // Currently processing messages
  private readonly inflightMessages: Set<Promise<void>> = new Set(); // Track in-flight message processing

  private constructor(
    pool: Pool,
    repository: PostgresQueueRepository,
    config: QueueConfig,
    tableName: string,
    channelName: string,
    ownsPool: boolean
  ) {
    super();
    this.pool = pool;
    this.repository = repository;
    this.config = config;
    this.tableName = tableName;
    this.channelName = channelName;
    this.ownsPool = ownsPool;
  }

  /**
   * Create a new queue instance
   *
   * @param config - Queue configuration
   * @returns PgQueue instance ready to use
   *
   * @example
   * ```typescript
   * // Option 1: Create queue with shared pool (recommended for production)
   * const sharedPool = new Pool({ connectionString: "postgresql://localhost:5432/mydb" });
   * const emailQueue = await PgQueue.create({
   *   pool: sharedPool,
   *   queueName: "emails"
   * });
   *
   * // Option 2: Create queue with its own pool (simple, but less efficient)
   * const emailQueue = await PgQueue.create({
   *   connectionString: "postgresql://localhost:5432/mydb",
   *   queueName: "emails"
   * });
   * ```
   */
  static async create(config: PgQueueConfig): Promise<PgQueue> {
    // Validate that either pool or connectionString is provided
    if (!config.pool && !config.connectionString) {
      throw new DatabaseError("Either pool or connectionString must be provided");
    }

    // Generate table name from queue name
    const tableName = getTableName(config.queueName);
    const channelName = `${tableName}_channel`;

    // Use provided pool or create a new one
    const pool = config.pool || new Pool({ connectionString: config.connectionString });
    const ownsPool = !config.pool; // We own the pool if we created it

    // Create validated config
    // When pool is provided, connectionString is not used but we pass a placeholder to satisfy validation
    const queueConfig = QueueConfig.create({
      tableName,
      channelName,
      connectionString: config.pool ? "pool-provided" : config.connectionString!,
      visibilityTimeoutMs: config.visibilityTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
      maxRetries: config.maxRetries,
    });

    // Auto-create table if enabled (default: true)
    // This is idempotent - safe to call multiple times
    if (config.autoCreate !== false) {
      await this.ensureTableExists(pool, tableName, channelName);
    }

    // Create repository
    const repository = new PostgresQueueRepository(pool, tableName);

    return new PgQueue(pool, repository, queueConfig, tableName, channelName, ownsPool);
  }

  /**
   * Generate SQL migration for manual table creation
   *
   * @param queueName - Queue name
   * @returns SQL migration script
   *
   * @example
   * ```typescript
   * const sql = PgQueue.generateMigration("emails");
   * console.log(sql); // CREATE TABLE systeric_pgqueue_emails...
   * ```
   */
  static generateMigration(queueName: string): string {
    const tableName = getTableName(queueName);
    const channelName = `${tableName}_channel`;
    return generateMigrationSQL(tableName, channelName);
  }

  /**
   * Ensure table exists (idempotent)
   * Creates table, indexes, and LISTEN/NOTIFY trigger if they don't exist
   * Uses to_regclass to respect custom schemas based on search_path
   */
  private static async ensureTableExists(
    pool: Pool,
    tableName: string,
    channelName: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Check if table exists using to_regclass (respects search_path)
      // to_regclass returns NULL if table doesn't exist
      const result = await client.query<{ exists: boolean }>(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [tableName]
      );

      if (!result.rows[0]?.exists) {
        // Create extension + table + indexes + trigger atomically
        await client.query("BEGIN");
        await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
        await client.query(generateTableSQL(tableName));
        await client.query(generateIndexesSQL(tableName));
        await client.query(generateNotifyTriggerSQL(tableName, channelName));
        await client.query("COMMIT");
      }
    } catch (error) {
      // Attempt rollback, but always throw the original error
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // Rollback failed, but the original error is more important
        // Log it or emit an event, but don't mask the original error
        console.error("Failed to rollback transaction:", rollbackError);
      }
      throw new DatabaseError("Failed to ensure table exists", error as Error);
    } finally {
      client.release();
    }
  }

  /**
   * Schedule next stale message check using recursive setTimeout
   * This pattern ensures no overlapping executions
   * Implements exponential backoff on persistent failures to prevent resource exhaustion
   */
  private scheduleStaleCheck(): void {
    if (!this.isRunning) return;

    // Apply backoff delay if there were previous failures
    const delay = this.config.getPollIntervalMs() + this.staleCheckBackoffMs;

    this.staleCheckTimeout = setTimeout(() => {
      void (async () => {
        try {
          const count = await this.repository.resetStaleMessages(
            this.config.getVisibilityTimeoutMs()
          );
          if (count > 0) {
            this.emit("stale:reset", count);
          }
          // Success - reset backoff
          this.staleCheckBackoffMs = 0;
        } catch (error) {
          // Preserve original error context including stack trace
          this.emit(
            "error",
            new BackgroundJobError("Failed to reset stale messages", error as Error)
          );
          // Implement exponential backoff: double the delay, capped at maxBackoffMs
          this.staleCheckBackoffMs = Math.min(
            this.staleCheckBackoffMs === 0 ? 1000 : this.staleCheckBackoffMs * 2,
            this.maxBackoffMs
          );
        } finally {
          // Schedule next check after current one completes
          this.scheduleStaleCheck();
        }
      })();
    }, delay);
  }

  /**
   * Schedule next retry check using recursive setTimeout
   * This pattern ensures no overlapping executions
   * Implements exponential backoff on persistent failures to prevent resource exhaustion
   */
  private scheduleRetryCheck(): void {
    if (!this.isRunning) return;

    // Apply backoff delay if there were previous failures
    const delay = this.config.getPollIntervalMs() + this.retryCheckBackoffMs;

    this.retryCheckTimeout = setTimeout(() => {
      void (async () => {
        try {
          const count = await this.repository.resetRetryableMessages();
          if (count > 0) {
            this.emit("retry:reset", count);
          }
          // Success - reset backoff
          this.retryCheckBackoffMs = 0;
        } catch (error) {
          // Preserve original error context including stack trace
          this.emit(
            "error",
            new BackgroundJobError("Failed to reset retryable messages", error as Error)
          );
          // Implement exponential backoff: double the delay, capped at maxBackoffMs
          this.retryCheckBackoffMs = Math.min(
            this.retryCheckBackoffMs === 0 ? 1000 : this.retryCheckBackoffMs * 2,
            this.maxBackoffMs
          );
        } finally {
          // Schedule next check after current one completes
          this.scheduleRetryCheck();
        }
      })();
    }, delay);
  }

  /**
   * Register a handler for a specific message type
   *
   * @param messageType - The message type to handle
   * @param handler - The handler function
   *
   * @example
   * ```typescript
   * queue.registerHandler('welcome-email', async (message) => {
   *   const { email, userId } = message.getPayload();
   *   await sendWelcomeEmail(email, userId);
   * });
   * ```
   */
  registerHandler(messageType: string, handler: MessageHandler): void {
    if (typeof handler !== "function") {
      throw new Error("Handler must be a function");
    }
    if (!messageType || messageType.trim() === "") {
      throw new Error("Message type cannot be empty");
    }
    this.handlers.set(messageType, handler);
  }

  /**
   * Start the queue worker
   * - Starts LISTEN/NOTIFY
   * - Starts background jobs (stale message check, retry check)
   * - Starts auto-consumption loop if handlers are registered
   *
   * @param options - Start options (concurrency, etc.)
   */
  async start(options?: StartOptions): Promise<void> {
    // Idempotent - if already running, just return
    if (this.isRunning) {
      return;
    }

    // Set concurrency
    this.concurrency = options?.concurrency || 1;

    // Start LISTEN/NOTIFY
    this.listenerClient = await this.pool.connect();
    await this.listenerClient.query(`LISTEN ${this.channelName}`);

    this.listenerClient.on("notification", (msg: Notification) => {
      if (msg.channel === this.channelName) {
        this.emit("notification", msg.payload);
        // Trigger consumption when new message arrives
        void this.triggerConsumption();
      }
    });

    // Start background jobs using recursive setTimeout pattern
    // This ensures no overlapping executions and consistent intervals
    this.isRunning = true;
    this.scheduleStaleCheck();
    this.scheduleRetryCheck();

    // Start auto-consumption by kicking off initial concurrent workers
    // Each worker will continue processing until the queue is empty
    for (let i = 0; i < this.concurrency; i++) {
      void this.triggerConsumption();
    }

    this.emit("started");
  }

  /**
   * Stop the queue worker
   * - Stops LISTEN/NOTIFY
   * - Stops background jobs
   * - Waits for in-flight messages to complete (graceful shutdown)
   * - Closes connection pool (ONLY if created by this queue, not if externally provided)
   *
   * NOTE: Does NOT delete the table - data persists
   */
  async stop(): Promise<void> {
    // Idempotent - if not running, just return
    if (!this.isRunning) {
      return;
    }

    // Stop background jobs by setting flag and clearing timeouts
    this.isRunning = false;
    if (this.staleCheckTimeout) {
      clearTimeout(this.staleCheckTimeout);
      this.staleCheckTimeout = null;
    }
    if (this.retryCheckTimeout) {
      clearTimeout(this.retryCheckTimeout);
      this.retryCheckTimeout = null;
    }

    // Wait for all in-flight messages to complete (graceful shutdown)
    if (this.inflightMessages.size > 0) {
      await Promise.all(Array.from(this.inflightMessages));
    }

    // Stop LISTEN
    if (this.listenerClient) {
      try {
        await this.listenerClient.query(`UNLISTEN ${this.channelName}`);
      } finally {
        // Always release client back to pool, even if UNLISTEN fails
        this.listenerClient.release();
        this.listenerClient = null;
      }
    }

    // Close pool ONLY if we created it (not externally provided)
    if (this.ownsPool) {
      await this.pool.end();
    }

    this.emit("stopped");
  }

  /**
   * Try to consume a single message if under concurrency limit
   * This method is self-perpetuating: when a message is processed,
   * it automatically tries to consume another one until the queue is empty.
   */
  private async triggerConsumption(): Promise<void> {
    // Stop if queue is no longer running
    if (!this.isRunning) {
      return;
    }

    // Check concurrency limit
    if (this.activeWorkers >= this.concurrency) {
      return;
    }

    // Try to dequeue a message
    const message = await this.dequeue();
    if (!message) {
      // No message available - worker becomes idle
      return;
    }

    // Process message asynchronously
    this.activeWorkers++;
    const processingPromise = this.processMessage(message).finally(() => {
      this.activeWorkers--;
      // Remove from in-flight set
      this.inflightMessages.delete(processingPromise);
      // A worker is now free - try to process another message immediately
      // This continues until the queue is empty, at which point the chain stops
      void this.triggerConsumption();
    });

    // Track in-flight message
    this.inflightMessages.add(processingPromise);
  }

  /**
   * Process a single message with its registered handler
   */
  private async processMessage(message: QueueMessage): Promise<void> {
    const messageType = message.getType();
    const handler = this.handlers.get(messageType);

    if (!handler) {
      // No handler registered for this message type
      const error = new NoHandlerRegisteredError(messageType);
      this.emit("error", error);
      // Nack the message so it can be retried or moved to DLQ
      await this.nack(message.getId(), error);
      return;
    }

    try {
      // Call the handler
      await handler(message);
      // Handler succeeded - ack the message
      await this.ack(message.getId());
    } catch (error) {
      // Handler failed - nack the message
      const handlerError = new HandlerExecutionError(messageType, error as Error);
      this.emit("error", handlerError);
      await this.nack(message.getId(), error as Error);
    }
  }

  /**
   * Enqueue a message
   *
   * @param props - Message properties
   * @returns MessageId
   *
   * @example
   * ```typescript
   * const id = await queue.enqueue({
   *   type: "welcome-email",
   *   payload: { userId: "123", email: "user@example.com" }
   * });
   * ```
   */
  async enqueue(props: QueueMessageProps): Promise<MessageId> {
    const message = QueueMessage.create({
      ...props,
      maxRetries: props.maxRetries || this.config.getMaxRetries(),
    });

    await this.repository.enqueue(message);
    this.emit("enqueued", message);

    return message.getId();
  }

  /**
   * Execute callback in a transaction with enqueue support
   * Useful for transactional outbox pattern
   *
   * @param callback - Transaction callback
   * @returns Result from callback
   *
   * @example
   * ```typescript
   * await queue.withTransaction(async (tx) => {
   *   // Update database
   *   await tx.query('UPDATE users SET status = $1 WHERE id = $2', ['active', userId]);
   *
   *   // Enqueue message in same transaction
   *   await tx.enqueue({ type: 'user-activated', payload: { userId } });
   * });
   * ```
   */
  async withTransaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Create transaction context with enqueue method
      const tx: TransactionContext = {
        query: client.query.bind(client),
        enqueue: async (props: QueueMessageProps) => {
          const message = QueueMessage.create({
            ...props,
            maxRetries: props.maxRetries || this.config.getMaxRetries(),
          });
          await this.repository.enqueue(message, { client });
          return message.getId();
        },
      };

      const result = await callback(tx);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      // Attempt rollback, but always throw the original error
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        // Rollback failed, but the original error is more important
        // Emit it as an event so it's not lost, but don't mask the original error
        this.emit(
          "error",
          new TransactionError("Failed to rollback transaction", rollbackError as Error)
        );
      }
      throw new TransactionError("Transaction failed", error as Error);
    } finally {
      client.release();
    }
  }

  /**
   * Dequeue next available message (PENDING, highest priority)
   * Uses FOR UPDATE SKIP LOCKED for work-stealing
   *
   * @returns QueueMessage or null if queue is empty
   */
  async dequeue(): Promise<QueueMessage | null> {
    const message = await this.repository.dequeue();
    if (message) {
      this.emit("dequeued", message);
    }
    return message;
  }

  /**
   * Acknowledge message (mark as COMPLETED)
   *
   * @param id - Message ID
   */
  async ack(id: MessageId): Promise<void> {
    await this.repository.ack(id);
    this.emit("ack", id);
  }

  /**
   * Negative acknowledge (mark as FAILED, schedule retry or DLQ)
   *
   * @param id - Message ID
   * @param error - Error that caused the failure
   */
  async nack(id: MessageId, error: Error): Promise<void> {
    await this.repository.nack(id, error);
    this.emit("nack", id, error);
  }

  /**
   * Get queue statistics
   *
   * @returns Queue stats (pending, processing, completed, failed, deadLetter counts)
   */
  async getStats() {
    return this.repository.getStats();
  }

  /**
   * Manually retry a message (resets retry count)
   *
   * @param id - Message ID
   */
  async retry(id: MessageId): Promise<void> {
    await this.repository.retry(id);
    this.emit("retry", id);
  }

  /**
   * Find messages by status
   *
   * @param status - MessageStatus
   * @param options - Find options (limit, orderBy, order)
   * @returns Array of QueueMessage
   */
  async findByStatus(status: MessageStatus, options?: FindOptions): Promise<QueueMessage[]> {
    return this.repository.findByStatus(status, options);
  }

  /**
   * Clean up old COMPLETED messages
   *
   * @param options - Cleanup options
   * @returns Number of messages deleted
   *
   * @example
   * ```typescript
   * // Delete all completed messages older than 7 days
   * const deleted = await queue.cleanupCompleted({ olderThanDays: 7 });
   * console.log(`Deleted ${deleted} old completed messages`);
   * ```
   */
  async cleanupCompleted(options: { olderThanDays: number }): Promise<number> {
    return this.repository.cleanupCompleted(options.olderThanDays);
  }

  /**
   * Clean up old DEAD_LETTER messages
   *
   * @param options - Cleanup options
   * @returns Number of messages deleted
   *
   * @example
   * ```typescript
   * // Delete all dead letter messages older than 30 days
   * const deleted = await queue.cleanupDeadLetters({ olderThanDays: 30 });
   * console.log(`Deleted ${deleted} old dead letter messages`);
   * ```
   */
  async cleanupDeadLetters(options: { olderThanDays: number }): Promise<number> {
    return this.repository.cleanupDeadLetters(options.olderThanDays);
  }

  /**
   * Get table name for this queue
   * Example: "systeric_pgqueue_emails"
   */
  getTableName(): string {
    return this.tableName;
  }

  /**
   * Get LISTEN/NOTIFY channel name
   * Example: "systeric_pgqueue_emails_channel"
   */
  getChannelName(): string {
    return this.channelName;
  }
}
