import { InvalidDurationError } from "../errors";

/**
 * Duration Value Object
 *
 * Represents a time duration (e.g., meeting length, task duration).
 * Immutable, self-validating, with default of 15 minutes.
 *
 * Key features:
 * - Default duration: 15 minutes (per TECHNICAL_FRAMEWORK.md)
 * - Range: 1 minute to 24 hours
 * - Immutable - all operations return new instances
 * - Human-readable formatting
 *
 * @example
 * ```typescript
 * const duration = Duration.default(); // 15 minutes
 * const custom = Duration.fromMinutes(30);
 * const longer = duration.add(Duration.fromHours(1));
 * console.log(duration.toHumanString()); // "15 minutes"
 * ```
 */
export class Duration {
  private readonly minutes: number;

  /** Default duration in minutes (15 min) */
  public static readonly DEFAULT_MINUTES = 15;

  /** Maximum duration in minutes (24 hours) */
  public static readonly MAX_MINUTES = 24 * 60;

  private constructor(minutes: number) {
    if (!Number.isFinite(minutes)) {
      throw new InvalidDurationError("Duration must be a finite number");
    }

    if (minutes < 0) {
      throw new InvalidDurationError("Duration cannot be negative");
    }

    if (minutes === 0) {
      throw new InvalidDurationError("Duration must be greater than zero");
    }

    if (minutes > Duration.MAX_MINUTES) {
      throw new InvalidDurationError("Duration cannot exceed 24 hours");
    }

    // Round to whole minutes
    this.minutes = Math.floor(minutes);
  }

  /**
   * Create duration from minutes
   */
  static fromMinutes(minutes: number): Duration {
    return new Duration(minutes);
  }

  /**
   * Create duration from hours
   */
  static fromHours(hours: number): Duration {
    return new Duration(hours * 60);
  }

  /**
   * Create default duration (15 minutes)
   */
  static default(): Duration {
    return new Duration(Duration.DEFAULT_MINUTES);
  }

  // Predefined common durations

  /**
   * 15-minute duration
   */
  static minutes15(): Duration {
    return new Duration(15);
  }

  /**
   * 30-minute duration
   */
  static minutes30(): Duration {
    return new Duration(30);
  }

  /**
   * 1-hour duration
   */
  static hours1(): Duration {
    return new Duration(60);
  }

  /**
   * 2-hour duration
   */
  static hours2(): Duration {
    return new Duration(120);
  }

  /**
   * Check if this duration is shorter than another
   */
  isShorterThan(other: Duration): boolean {
    return this.minutes < other.minutes;
  }

  /**
   * Check if this duration is longer than another
   */
  isLongerThan(other: Duration): boolean {
    return this.minutes > other.minutes;
  }

  /**
   * Check if this duration equals another
   */
  equals(other: Duration): boolean {
    return this.minutes === other.minutes;
  }

  /**
   * Check if this is the default duration (15 minutes)
   */
  isDefault(): boolean {
    return this.minutes === Duration.DEFAULT_MINUTES;
  }

  /**
   * Add another duration (returns new instance)
   */
  add(other: Duration): Duration {
    return new Duration(this.minutes + other.minutes);
  }

  /**
   * Subtract another duration (returns new instance)
   * @throws InvalidDurationError if result would be negative
   */
  subtract(other: Duration): Duration {
    const result = this.minutes - other.minutes;
    if (result < 0) {
      throw new InvalidDurationError("Duration cannot be negative");
    }
    return new Duration(result);
  }

  /**
   * Multiply duration by a factor (returns new instance)
   */
  multiply(factor: number): Duration {
    return new Duration(this.minutes * factor);
  }

  /**
   * Divide duration by a factor (returns new instance)
   */
  divide(factor: number): Duration {
    return new Duration(Math.floor(this.minutes / factor));
  }

  /**
   * Get duration in minutes
   */
  toMinutes(): number {
    return this.minutes;
  }

  /**
   * Get duration in hours (decimal)
   */
  toHours(): number {
    return this.minutes / 60;
  }

  /**
   * Get duration in milliseconds
   */
  toMilliseconds(): number {
    return this.minutes * 60 * 1000;
  }

  /**
   * Format to human-readable string
   * @example "1 hour 30 minutes", "45 minutes", "2 hours"
   */
  toHumanString(): string {
    const hours = Math.floor(this.minutes / 60);
    const remainingMinutes = this.minutes % 60;

    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    }

    if (remainingMinutes > 0) {
      parts.push(`${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"}`);
    }

    return parts.join(" ");
  }

  /**
   * String representation (human-readable)
   */
  toString(): string {
    return this.toHumanString();
  }

  /**
   * JSON serialization (minutes)
   */
  toJSON(): number {
    return this.minutes;
  }
}
