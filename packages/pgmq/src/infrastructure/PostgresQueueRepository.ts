import { Pool } from "pg";
import {
  QueueRepository,
  QueueStats,
  EnqueueOptions,
  FindOptions,
} from "../application/ports/QueueRepository";
import { QueueMessage } from "../domain/entities/QueueMessage";
import { MessageId } from "../domain/vo/MessageId";
import { MessageStatus } from "../domain/vo/MessageStatus";
import { MessagePriority } from "../domain/vo/MessagePriority";
import {
  MessageNotFoundError,
  MessageRaceConditionError,
  InvalidQueryParameterError,
} from "../domain/errors/PgQueueErrors";

/**
 * Database row type for queue messages
 */
interface QueueMessageRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  priority: number;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  next_retry_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class PostgresQueueRepository implements QueueRepository {
  constructor(
    private readonly pool: Pool,
    private readonly tableName: string
  ) {}

  async enqueue(message: QueueMessage, options?: EnqueueOptions): Promise<void> {
    const client = options?.client || this.pool;

    await client.query(
      `INSERT INTO ${this.tableName}
       (id, type, payload, status, priority, retry_count, max_retries, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        message.getId().getValue(),
        message.getType(),
        JSON.stringify(message.getPayload()),
        message.getStatus().toString(),
        message.getPriority().getValue(),
        message.getRetryCount(),
        message.getMaxRetries(),
        message.getCreatedAt(),
        message.getUpdatedAt(),
      ]
    );
  }

  async dequeue(): Promise<QueueMessage | null> {
    const result = await this.pool.query<QueueMessageRow>(
      `UPDATE ${this.tableName}
       SET status = $1, updated_at = NOW()
       WHERE id = (
         SELECT id FROM ${this.tableName}
         WHERE status = $2
         ORDER BY priority ASC, created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING *`,
      [MessageStatus.PROCESSING.toString(), MessageStatus.PENDING.toString()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToMessage(result.rows[0]);
  }

  async ack(id: MessageId): Promise<void> {
    await this.pool.query(
      `UPDATE ${this.tableName}
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status = $3`,
      [MessageStatus.COMPLETED.toString(), id.getValue(), MessageStatus.PROCESSING.toString()]
    );
  }

  async nack(id: MessageId, error: Error): Promise<void> {
    // Fetch current message to apply business logic
    const message = await this.findById(id);
    if (!message) {
      throw new MessageNotFoundError(id.toString());
    }

    message.markAsFailed(error);

    // Update with WHERE clause checking status is still PROCESSING
    // This prevents race condition where message could be reset by stale worker
    const result = await this.pool.query(
      `UPDATE ${this.tableName}
       SET status = $1, retry_count = $2, last_error = $3, next_retry_at = $4, updated_at = NOW()
       WHERE id = $5 AND status = $6`,
      [
        message.getStatus().toString(),
        message.getRetryCount(),
        message.getLastError(),
        message.getNextRetryAt(),
        id.getValue(),
        MessageStatus.PROCESSING.toString(),
      ]
    );

    // If no rows were updated, the message was not in PROCESSING state
    if (result.rowCount === 0) {
      throw new MessageRaceConditionError(
        `Message ${id.toString()} is not in PROCESSING state, cannot nack (possible race condition)`
      );
    }
  }

  async findById(id: MessageId): Promise<QueueMessage | null> {
    const result = await this.pool.query<QueueMessageRow>(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id.getValue()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToMessage(result.rows[0]);
  }

  async findByStatus(status: MessageStatus, options?: FindOptions): Promise<QueueMessage[]> {
    const limit = options?.limit || 100;
    const orderBy = options?.orderBy || "created_at";
    const order = options?.order || "DESC";

    // Validate against allowlist to prevent SQL injection (defense-in-depth)
    const allowedOrderBy: Array<NonNullable<FindOptions["orderBy"]>> = ["created_at", "priority"];
    const allowedOrder: Array<NonNullable<FindOptions["order"]>> = ["ASC", "DESC"];

    if (!allowedOrderBy.includes(orderBy)) {
      throw new InvalidQueryParameterError(`Invalid orderBy column: ${orderBy}`);
    }
    if (!allowedOrder.includes(order)) {
      throw new InvalidQueryParameterError(`Invalid order direction: ${order}`);
    }

    const result = await this.pool.query<QueueMessageRow>(
      `SELECT * FROM ${this.tableName}
       WHERE status = $1
       ORDER BY ${orderBy} ${order}
       LIMIT $2`,
      [status.toString(), limit]
    );

    return result.rows.map((row) => this.rowToMessage(row));
  }

  async getStats(): Promise<QueueStats> {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
         COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing,
         COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
         COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
         COUNT(*) FILTER (WHERE status = 'DEAD_LETTER') as dead_letter,
         EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) * 1000 as oldest_age
       FROM ${this.tableName}`
    );

    const row = result.rows[0] as {
      pending: string;
      processing: string;
      completed: string;
      failed: string;
      dead_letter: string;
      oldest_age: number | null;
    };

    return {
      pending: parseInt(row.pending, 10),
      processing: parseInt(row.processing, 10),
      completed: parseInt(row.completed, 10),
      failed: parseInt(row.failed, 10),
      deadLetter: parseInt(row.dead_letter, 10),
      oldestMessageAge: row.oldest_age ? Math.floor(row.oldest_age) : null,
    };
  }

  async resetStaleMessages(visibilityTimeoutMs: number): Promise<number> {
    const thresholdTime = new Date(Date.now() - visibilityTimeoutMs);

    const result = await this.pool.query(
      `UPDATE ${this.tableName}
       SET status = $1, updated_at = NOW()
       WHERE status = $2 AND updated_at < $3
       RETURNING id`,
      [MessageStatus.PENDING.toString(), MessageStatus.PROCESSING.toString(), thresholdTime]
    );

    return result.rowCount || 0;
  }

  async resetRetryableMessages(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE ${this.tableName}
       SET status = $1, next_retry_at = NULL, updated_at = NOW()
       WHERE status = $2 AND next_retry_at <= NOW()
       RETURNING id`,
      [MessageStatus.PENDING.toString(), MessageStatus.FAILED.toString()]
    );

    return result.rowCount || 0;
  }

  async retry(id: MessageId): Promise<void> {
    await this.pool.query(
      `UPDATE ${this.tableName}
       SET status = $1, retry_count = 0, last_error = NULL, next_retry_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [MessageStatus.PENDING.toString(), id.getValue()]
    );
  }

  async cleanupCompleted(olderThanDays: number): Promise<number> {
    const thresholdDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.pool.query(
      `DELETE FROM ${this.tableName}
       WHERE status = $1 AND created_at < $2`,
      [MessageStatus.COMPLETED.toString(), thresholdDate]
    );

    return result.rowCount || 0;
  }

  async cleanupDeadLetters(olderThanDays: number): Promise<number> {
    const thresholdDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await this.pool.query(
      `DELETE FROM ${this.tableName}
       WHERE status = $1 AND created_at < $2`,
      [MessageStatus.DEAD_LETTER.toString(), thresholdDate]
    );

    return result.rowCount || 0;
  }

  private rowToMessage(row: QueueMessageRow): QueueMessage {
    return QueueMessage.reconstitute({
      id: MessageId.fromString(row.id),
      type: row.type,
      payload: row.payload,
      status: MessageStatus.fromString(row.status),
      priority: MessagePriority.create(row.priority),
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastError: row.last_error,
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
