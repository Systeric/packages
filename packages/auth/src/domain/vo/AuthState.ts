import { randomBytes } from "crypto";

/**
 * Default TTL for auth state (10 minutes)
 */
const DEFAULT_STATE_TTL_SECONDS = 600;

/**
 * AuthState Value Object
 *
 * Represents OAuth2 state parameter for CSRF protection.
 * Immutable, self-validating, with expiry tracking.
 */
export class AuthState {
  private readonly value: string;
  private readonly expiresAt: number;

  private constructor(value: string, expiresAt: number) {
    this.value = value;
    this.expiresAt = expiresAt;
  }

  /**
   * Generate a cryptographically secure random state
   * @param ttlSeconds - Time to live in seconds (default 10 minutes)
   */
  static generate(ttlSeconds: number = DEFAULT_STATE_TTL_SECONDS): AuthState {
    const value = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + ttlSeconds * 1000;
    return new AuthState(value, expiresAt);
  }

  /**
   * Create AuthState from an existing value
   * @param value - State string (must be at least 16 characters)
   * @param ttlSeconds - Time to live in seconds (default 10 minutes)
   * @throws Error if value is invalid
   */
  static fromString(value: string, ttlSeconds: number = DEFAULT_STATE_TTL_SECONDS): AuthState {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      throw new Error("Auth state cannot be empty");
    }

    if (trimmed.length < 16) {
      throw new Error("Auth state must be at least 16 characters");
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    return new AuthState(trimmed, expiresAt);
  }

  /**
   * Restore AuthState from JSON
   * @throws Error if state has expired
   */
  static fromJSON(json: { value: string; expiresAt: number }): AuthState {
    if (json.expiresAt <= Date.now()) {
      throw new Error("Auth state has expired");
    }

    return new AuthState(json.value, json.expiresAt);
  }

  /**
   * Get the state value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check if state has expired
   */
  isExpired(): boolean {
    return Date.now() >= this.expiresAt;
  }

  /**
   * Get seconds until state expires
   */
  secondsUntilExpiry(): number {
    const ms = this.expiresAt - Date.now();
    return ms > 0 ? Math.floor(ms / 1000) : 0;
  }

  /**
   * Validate against another AuthState
   */
  validate(other: AuthState): boolean {
    if (this.isExpired() || other.isExpired()) {
      return false;
    }

    return this.value === other.value;
  }

  /**
   * Validate against a string value
   */
  validateString(value: string): boolean {
    if (this.isExpired()) {
      return false;
    }

    return this.value === value;
  }

  /**
   * Compare with another AuthState
   */
  equals(other: AuthState): boolean {
    return this.value === other.value;
  }

  /**
   * Serialize to JSON
   */
  toJSON(): { value: string; expiresAt: number } {
    return {
      value: this.value,
      expiresAt: this.expiresAt,
    };
  }
}
