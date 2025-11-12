/**
 * Base error class for queue-related errors
 */
export class QueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueError";
  }
}

/**
 * Error thrown when a message is not found
 */
export class MessageNotFoundError extends QueueError {
  constructor(messageId: string) {
    super(`Message not found: ${messageId}`);
    this.name = "MessageNotFoundError";
  }
}

/**
 * Error thrown when attempting an invalid status transition
 */
export class InvalidStatusTransitionError extends QueueError {
  constructor(from: string, to: string) {
    super(`Invalid status transition from ${from} to ${to}`);
    this.name = "InvalidStatusTransitionError";
  }
}

/**
 * Error thrown when queue configuration is invalid
 */
export class InvalidQueueConfigError extends QueueError {
  constructor(message: string) {
    super(`Invalid queue configuration: ${message}`);
    this.name = "InvalidQueueConfigError";
  }
}

/**
 * Error thrown when database connection fails
 */
export class DatabaseConnectionError extends QueueError {
  constructor(message: string) {
    super(`Database connection error: ${message}`);
    this.name = "DatabaseConnectionError";
  }
}
