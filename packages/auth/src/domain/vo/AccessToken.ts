/**
 * AccessToken Value Object
 *
 * Represents an OAuth2 access token with expiry tracking.
 * Immutable and self-validating.
 */
export class AccessToken {
  private readonly token: string;
  private readonly expiresAt: number;

  private constructor(token: string, expiresAt: number) {
    this.token = token;
    this.expiresAt = expiresAt;
  }

  /**
   * Create an AccessToken from a string and expiry time in seconds
   * @param token - The access token string
   * @param expiresIn - Time in seconds until token expires (can be 0 or negative for expired tokens)
   * @throws Error if token is empty
   */
  static fromString(token: string, expiresIn: number): AccessToken {
    const trimmed = token.trim();

    if (trimmed.length === 0) {
      throw new Error("Access token cannot be empty");
    }

    const expiresAt = Date.now() + expiresIn * 1000;
    return new AccessToken(trimmed, expiresAt);
  }

  /**
   * Restore an AccessToken from JSON
   * @param json - Serialized token data
   * @throws Error if token has expired
   */
  static fromJSON(json: { token: string; expiresAt: number }): AccessToken {
    if (json.expiresAt <= Date.now()) {
      throw new Error("Token has expired");
    }

    return new AccessToken(json.token, json.expiresAt);
  }

  /**
   * Get the raw token value
   */
  getValue(): string {
    return this.token;
  }

  /**
   * Check if the token has expired
   */
  isExpired(): boolean {
    return Date.now() >= this.expiresAt;
  }

  /**
   * Get seconds until token expires (0 if already expired)
   */
  secondsUntilExpiry(): number {
    const ms = this.expiresAt - Date.now();
    return ms > 0 ? Math.floor(ms / 1000) : 0;
  }

  /**
   * Check if token should be refreshed (less than 5 minutes left)
   */
  needsRefresh(): boolean {
    const REFRESH_THRESHOLD = 5 * 60; // 5 minutes in seconds
    return this.secondsUntilExpiry() < REFRESH_THRESHOLD;
  }

  /**
   * Compare with another AccessToken
   */
  equals(other: AccessToken): boolean {
    return this.token === other.token;
  }

  /**
   * Serialize to JSON for storage
   */
  toJSON(): { token: string; expiresAt: number } {
    return {
      token: this.token,
      expiresAt: this.expiresAt,
    };
  }
}
