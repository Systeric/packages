import { MessageId } from "../vo/MessageId";
import { MessageStatus } from "../vo/MessageStatus";
import { MessagePriority } from "../vo/MessagePriority";
import { MessageValidationError, InvalidMessageStateError } from "../errors/PgQueueErrors";

export interface QueueMessageProps {
  type: string;
  payload: Record<string, unknown>;
  priority?: MessagePriority;
  maxRetries?: number;
}

export interface QueueMessageData {
  id: MessageId;
  type: string;
  payload: Record<string, unknown>;
  status: MessageStatus;
  priority: MessagePriority;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * QueueMessage entity
 * Represents a message in the queue with its lifecycle state
 */
export class QueueMessage {
  private readonly id: MessageId;
  private readonly type: string;
  private readonly payload: Record<string, unknown>;
  private status: MessageStatus;
  private readonly priority: MessagePriority;
  private retryCount: number;
  private readonly maxRetries: number;
  private lastError: string | null;
  private nextRetryAt: Date | null;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(data: QueueMessageData) {
    this.id = data.id;
    this.type = data.type;
    this.payload = data.payload;
    this.status = data.status;
    this.priority = data.priority;
    this.retryCount = data.retryCount;
    this.maxRetries = data.maxRetries;
    this.lastError = data.lastError;
    this.nextRetryAt = data.nextRetryAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  /**
   * Create a new message (PENDING status)
   */
  static create(props: QueueMessageProps): QueueMessage {
    // Validate type
    const type = props.type.trim();
    if (!type) {
      throw new MessageValidationError("Message type cannot be empty");
    }
    if (type.length > 255) {
      throw new MessageValidationError("Message type cannot exceed 255 characters");
    }

    // Validate payload
    if (props.payload === null || props.payload === undefined) {
      throw new MessageValidationError("Payload cannot be null or undefined");
    }

    // Validate maxRetries
    const maxRetries = props.maxRetries ?? 3;
    if (maxRetries < 1) {
      throw new MessageValidationError("Max retries must be at least 1");
    }

    const now = new Date();

    return new QueueMessage({
      id: MessageId.generate(),
      type,
      payload: props.payload,
      status: MessageStatus.PENDING,
      priority: props.priority ?? MessagePriority.NORMAL,
      retryCount: 0,
      maxRetries,
      lastError: null,
      nextRetryAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstitute message from database data
   */
  static reconstitute(data: QueueMessageData): QueueMessage {
    return new QueueMessage(data);
  }

  /**
   * Mark message as PROCESSING
   */
  markAsProcessing(): void {
    if (!this.status.isPending()) {
      throw new InvalidMessageStateError("Cannot mark as processing: message is not pending");
    }

    this.status = MessageStatus.PROCESSING;
    this.updatedAt = new Date();
  }

  /**
   * Mark message as COMPLETED
   */
  markAsCompleted(): void {
    if (!this.status.isProcessing()) {
      throw new InvalidMessageStateError("Cannot mark as completed: message is not processing");
    }

    this.status = MessageStatus.COMPLETED;
    this.updatedAt = new Date();
  }

  /**
   * Mark message as FAILED with error
   * Increments retry count and calculates next retry time
   */
  markAsFailed(error: Error): void {
    if (!this.status.isProcessing()) {
      throw new InvalidMessageStateError("Cannot mark as failed: message is not processing");
    }

    this.retryCount++;
    this.lastError = error.message;

    // Check if we've exceeded max retries
    if (this.retryCount > this.maxRetries) {
      this.status = MessageStatus.DEAD_LETTER;
      this.nextRetryAt = null;
    } else {
      this.status = MessageStatus.FAILED;
      // Calculate next retry time using exponential backoff
      this.nextRetryAt = this.calculateNextRetryAt();
    }

    this.updatedAt = new Date();
  }

  /**
   * Reset FAILED message back to PENDING for automatic retry
   */
  resetToPending(): void {
    if (!this.status.isFailed()) {
      throw new InvalidMessageStateError("Cannot reset to pending: message is not failed");
    }

    this.status = MessageStatus.PENDING;
    this.nextRetryAt = null;
    this.updatedAt = new Date();
  }

  /**
   * Manual retry - resets retry count and status
   * Used for retrying DEAD_LETTER messages or resetting failed messages
   */
  retry(): void {
    this.status = MessageStatus.PENDING;
    this.retryCount = 0;
    this.lastError = null;
    this.nextRetryAt = null;
    this.updatedAt = new Date();
  }

  /**
   * Check if message is stale (processing too long)
   */
  isStale(visibilityTimeoutMs: number): boolean {
    if (!this.status.isProcessing()) {
      return false;
    }

    const processingDuration = Date.now() - this.updatedAt.getTime();
    return processingDuration > visibilityTimeoutMs;
  }

  /**
   * Check if FAILED message is ready for retry
   */
  isReadyForRetry(): boolean {
    if (!this.status.isFailed()) {
      return false;
    }

    if (!this.nextRetryAt) {
      return false;
    }

    return this.nextRetryAt.getTime() <= Date.now();
  }

  /**
   * Calculate next retry time using exponential backoff
   * Retry 1: 1s, Retry 2: 2s, Retry 3: 4s, Retry 4: 8s, max: 60s
   */
  private calculateNextRetryAt(): Date {
    const backoffSeconds = Math.min(
      Math.pow(2, this.retryCount - 1),
      60 // Max 60 seconds
    );

    return new Date(Date.now() + backoffSeconds * 1000);
  }

  // Getters
  getId(): MessageId {
    return this.id;
  }

  getType(): string {
    return this.type;
  }

  getPayload(): Record<string, unknown> {
    return this.payload;
  }

  getStatus(): MessageStatus {
    return this.status;
  }

  getPriority(): MessagePriority {
    return this.priority;
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getNextRetryAt(): Date | null {
    return this.nextRetryAt;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }
}
