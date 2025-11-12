/**
 * Base error class for all pgmq errors
 */
export abstract class PgQueueError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;

    // Preserve stack trace
    if (cause && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when an idempotency operation fails
 */
export class IdempotencyError extends PgQueueError {
  constructor(message: string, cause?: Error) {
    super(message, "IDEMPOTENCY_ERROR", cause);
  }
}

/**
 * Thrown when a database operation fails
 */
export class DatabaseError extends PgQueueError {
  constructor(message: string, cause?: Error) {
    super(message, "DATABASE_ERROR", cause);
  }
}

/**
 * Thrown when a transaction fails
 */
export class TransactionError extends PgQueueError {
  constructor(message: string, cause?: Error) {
    super(message, "TRANSACTION_ERROR", cause);
  }
}

/**
 * Thrown when a message operation fails
 */
export class MessageOperationError extends PgQueueError {
  constructor(message: string, cause?: Error) {
    super(message, "MESSAGE_OPERATION_ERROR", cause);
  }
}

/**
 * Thrown when a background job fails
 */
export class BackgroundJobError extends PgQueueError {
  constructor(message: string, cause?: Error) {
    super(message, "BACKGROUND_JOB_ERROR", cause);
  }
}

/**
 * Thrown when an idempotency key is currently being processed
 */
export class IdempotencyKeyInProcessError extends IdempotencyError {
  constructor(idempotencyKey: string) {
    super(`Operation with idempotency key "${idempotencyKey}" is currently being processed`);
  }
}

/**
 * Thrown when trying to claim an idempotency key fails due to connection issues
 */
export class IdempotencyClaimError extends IdempotencyError {
  constructor(idempotencyKey: string, cause: Error) {
    super(`Failed to claim idempotency key "${idempotencyKey}"`, cause);
  }
}

/**
 * Thrown when a database connection error occurs
 */
export class ConnectionError extends DatabaseError {
  constructor(message: string, cause: Error) {
    super(message, cause);
  }
}

/**
 * Thrown when a unique constraint violation occurs
 */
export class UniqueConstraintError extends DatabaseError {
  constructor(message: string, cause: Error) {
    super(message, cause);
  }
}

/**
 * Thrown when message validation fails
 */
export class MessageValidationError extends PgQueueError {
  constructor(message: string) {
    super(message, "MESSAGE_VALIDATION_ERROR");
  }
}

/**
 * Thrown when message state transition is invalid
 */
export class InvalidMessageStateError extends PgQueueError {
  constructor(message: string) {
    super(message, "INVALID_MESSAGE_STATE_ERROR");
  }
}

/**
 * Thrown when a message is not found
 */
export class MessageNotFoundError extends PgQueueError {
  constructor(messageId: string) {
    super(`Message ${messageId} not found`, "MESSAGE_NOT_FOUND_ERROR");
  }
}

/**
 * Thrown when a message cannot be updated due to race condition
 */
export class MessageRaceConditionError extends PgQueueError {
  constructor(message: string) {
    super(message, "MESSAGE_RACE_CONDITION_ERROR");
  }
}

/**
 * Thrown when query parameters fail validation
 */
export class InvalidQueryParameterError extends PgQueueError {
  constructor(message: string) {
    super(message, "INVALID_QUERY_PARAMETER_ERROR");
  }
}
