import { type PoolClient } from "pg";
import { MessageId } from "../../domain/vo/MessageId";
import { MessageStatus } from "../../domain/vo/MessageStatus";
import { QueueMessage } from "../../domain/entities/QueueMessage";

export interface EnqueueOptions {
  client?: PoolClient; // pg Client for transactions
}

export interface FindOptions {
  limit?: number;
  orderBy?: "created_at" | "priority";
  order?: "ASC" | "DESC";
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  oldestMessageAge: number | null; // milliseconds
}

/**
 * Repository port for queue operations
 * Infrastructure layer implements this interface
 */
export interface QueueRepository {
  /**
   * Enqueue a new message
   */
  enqueue(message: QueueMessage, options?: EnqueueOptions): Promise<void>;

  /**
   * Dequeue next available message (PENDING, highest priority)
   * Uses FOR UPDATE SKIP LOCKED for work-stealing
   */
  dequeue(): Promise<QueueMessage | null>;

  /**
   * Mark message as completed
   */
  ack(id: MessageId): Promise<void>;

  /**
   * Mark message as failed and schedule retry
   */
  nack(id: MessageId, error: Error): Promise<void>;

  /**
   * Find message by ID
   */
  findById(id: MessageId): Promise<QueueMessage | null>;

  /**
   * Find messages by status
   */
  findByStatus(status: MessageStatus, options?: FindOptions): Promise<QueueMessage[]>;

  /**
   * Get queue statistics
   */
  getStats(): Promise<QueueStats>;

  /**
   * Reset stale PROCESSING messages back to PENDING
   * Returns count of reset messages
   */
  resetStaleMessages(visibilityTimeoutMs: number): Promise<number>;

  /**
   * Reset FAILED messages that are ready for retry
   * Returns count of reset messages
   */
  resetRetryableMessages(): Promise<number>;

  /**
   * Manually retry a message (resets retry count)
   */
  retry(id: MessageId): Promise<void>;

  /**
   * Delete old COMPLETED messages
   * Returns count of deleted messages
   */
  cleanupCompleted(olderThanDays: number): Promise<number>;

  /**
   * Delete old DEAD_LETTER messages
   * Returns count of deleted messages
   */
  cleanupDeadLetters(olderThanDays: number): Promise<number>;
}
