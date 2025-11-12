/**
 * Base error for all calendar domain errors
 */
export class CalendarDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CalendarDomainError";
    Object.setPrototypeOf(this, CalendarDomainError.prototype);
  }
}

/**
 * Error thrown when UTC value is invalid
 */
export class InvalidUTCError extends CalendarDomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUTCError";
    Object.setPrototypeOf(this, InvalidUTCError.prototype);
  }
}

/**
 * Error thrown when Duration value is invalid
 */
export class InvalidDurationError extends CalendarDomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDurationError";
    Object.setPrototypeOf(this, InvalidDurationError.prototype);
  }
}

/**
 * Error thrown when TimeWindow value is invalid
 */
export class InvalidTimeWindowError extends CalendarDomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTimeWindowError";
    Object.setPrototypeOf(this, InvalidTimeWindowError.prototype);
  }
}

/**
 * Error thrown when EventId value is invalid
 */
export class InvalidEventIdError extends CalendarDomainError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEventIdError";
    Object.setPrototypeOf(this, InvalidEventIdError.prototype);
  }
}
