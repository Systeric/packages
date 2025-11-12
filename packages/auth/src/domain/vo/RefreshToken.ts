/**
 * RefreshToken Value Object
 *
 * Represents an OAuth2 refresh token.
 * Immutable, secure, and self-validating.
 * Refresh tokens don't expire (or have very long expiry).
 */
export class RefreshToken {
  private readonly token: string;

  private constructor(token: string) {
    this.token = token;
  }

  /**
   * Create a RefreshToken from a string
   * @param token - The refresh token string
   * @throws Error if token is empty
   */
  static fromString(token: string): RefreshToken {
    const trimmed = token.trim();

    if (trimmed.length === 0) {
      throw new Error("Refresh token cannot be empty");
    }

    return new RefreshToken(trimmed);
  }

  /**
   * Restore a RefreshToken from JSON
   */
  static fromJSON(json: { token: string }): RefreshToken {
    return RefreshToken.fromString(json.token);
  }

  /**
   * Get the raw token value
   * Use with caution - this is a sensitive value
   */
  getValue(): string {
    return this.token;
  }

  /**
   * Compare with another RefreshToken
   */
  equals(other: RefreshToken): boolean {
    return this.token === other.token;
  }

  /**
   * Serialize to JSON for storage
   * WARNING: Store encrypted in production
   */
  toJSON(): { token: string } {
    return {
      token: this.token,
    };
  }

  /**
   * Get masked token for logging (safe to log)
   * Shows first 3 and last 6 characters
   */
  toMaskedString(): string {
    if (this.token.length <= 10) {
      return "***";
    }

    const prefix = this.token.substring(0, 3);
    const suffix = this.token.substring(this.token.length - 6);
    return `${prefix}***${suffix}`;
  }

  /**
   * String representation (safe - doesn't expose token)
   */
  toString(): string {
    return `RefreshToken(${this.toMaskedString()})`;
  }
}
