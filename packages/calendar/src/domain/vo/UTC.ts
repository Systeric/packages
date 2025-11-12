import { InvalidUTCError } from "../errors";

/**
 * UTC Value Object
 *
 * Represents a point in time, always stored in UTC.
 * Immutable, self-validating, and provides timezone-safe operations.
 *
 * Key features:
 * - Always stores time in UTC (no timezone ambiguity)
 * - Immutable - all operations return new instances
 * - Type-safe arithmetic operations
 * - Comparison operations
 * - Handles timezone conversions automatically
 *
 * @example
 * ```typescript
 * const utc = UTC.now();
 * const later = utc.addHours(2);
 * const isoString = utc.toISO();
 * ```
 */
export class UTC {
  private readonly timestamp: number;

  private constructor(timestamp: number) {
    this.timestamp = timestamp;
  }

  /**
   * Create UTC from a Date object
   * Automatically converts to UTC regardless of input timezone
   */
  static fromDate(date: Date): UTC {
    return new UTC(date.getTime());
  }

  /**
   * Create UTC from ISO 8601 string
   * @throws InvalidUTCError if string is invalid
   */
  static fromISO(isoString: string): UTC {
    if (isoString.trim().length === 0) {
      throw new InvalidUTCError("ISO date string cannot be empty");
    }

    const date = new Date(isoString);

    if (isNaN(date.getTime())) {
      throw new InvalidUTCError("Invalid ISO date string");
    }

    return new UTC(date.getTime());
  }

  /**
   * Create UTC for current moment
   */
  static now(): UTC {
    return new UTC(Date.now());
  }

  /**
   * Create UTC from Unix timestamp (milliseconds)
   * @throws InvalidUTCError if timestamp is invalid
   */
  static fromTimestamp(timestamp: number): UTC {
    if (!Number.isFinite(timestamp)) {
      throw new InvalidUTCError("Timestamp must be a finite number");
    }

    if (timestamp < 0) {
      throw new InvalidUTCError("Timestamp cannot be negative");
    }

    return new UTC(timestamp);
  }

  /**
   * Check if this time is before another
   */
  isBefore(other: UTC): boolean {
    return this.timestamp < other.timestamp;
  }

  /**
   * Check if this time is after another
   */
  isAfter(other: UTC): boolean {
    return this.timestamp > other.timestamp;
  }

  /**
   * Check if this time equals another
   */
  equals(other: UTC): boolean {
    return this.timestamp === other.timestamp;
  }

  /**
   * Check if this time is in the past
   */
  isPast(): boolean {
    return this.timestamp < Date.now();
  }

  /**
   * Check if this time is in the future
   */
  isFuture(): boolean {
    return this.timestamp > Date.now();
  }

  /**
   * Add minutes to this time (returns new instance)
   */
  addMinutes(minutes: number): UTC {
    return new UTC(this.timestamp + minutes * 60 * 1000);
  }

  /**
   * Subtract minutes from this time (returns new instance)
   */
  subtractMinutes(minutes: number): UTC {
    return this.addMinutes(-minutes);
  }

  /**
   * Add hours to this time (returns new instance)
   */
  addHours(hours: number): UTC {
    return this.addMinutes(hours * 60);
  }

  /**
   * Add days to this time (returns new instance)
   */
  addDays(days: number): UTC {
    return this.addHours(days * 24);
  }

  /**
   * Calculate difference in milliseconds (this - other)
   */
  diffInMilliseconds(other: UTC): number {
    return this.timestamp - other.timestamp;
  }

  /**
   * Calculate difference in minutes (this - other)
   */
  diffInMinutes(other: UTC): number {
    return Math.floor(this.diffInMilliseconds(other) / (60 * 1000));
  }

  /**
   * Calculate difference in hours (this - other)
   */
  diffInHours(other: UTC): number {
    return Math.floor(this.diffInMinutes(other) / 60);
  }

  /**
   * Calculate difference in days (this - other)
   */
  diffInDays(other: UTC): number {
    return Math.floor(this.diffInHours(other) / 24);
  }

  /**
   * Convert to ISO 8601 string (always UTC with Z suffix)
   */
  toISO(): string {
    return new Date(this.timestamp).toISOString();
  }

  /**
   * Convert to Unix timestamp (milliseconds)
   */
  toTimestamp(): number {
    return this.timestamp;
  }

  /**
   * Convert to JavaScript Date object
   */
  toDate(): Date {
    return new Date(this.timestamp);
  }

  /**
   * String representation (ISO format)
   */
  toString(): string {
    return this.toISO();
  }

  /**
   * JSON serialization (ISO format)
   */
  toJSON(): string {
    return this.toISO();
  }
}
