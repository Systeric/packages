/**
 * Scopes Value Object
 *
 * Represents OAuth2 scopes with validation and common operations.
 * Immutable and self-validating.
 */
export class Scopes {
  private readonly scopes: Set<string>;

  private constructor(scopes: string[]) {
    this.scopes = new Set(scopes);
  }

  /**
   * Create Scopes from an array of scope strings
   * @param scopes - Array of scope strings
   * @throws Error if no scopes provided
   */
  static fromArray(scopes: string[]): Scopes {
    const cleaned = scopes.map((s) => s.trim()).filter((s) => s.length > 0);

    if (cleaned.length === 0) {
      throw new Error("At least one scope is required");
    }

    return new Scopes(cleaned);
  }

  /**
   * Create Scopes from a space-separated string
   * @param scopeString - Space-separated scopes
   */
  static fromString(scopeString: string): Scopes {
    const scopes = scopeString
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return Scopes.fromArray(scopes);
  }

  /**
   * Restore Scopes from JSON
   */
  static fromJSON(scopes: string[]): Scopes {
    return Scopes.fromArray(scopes);
  }

  /**
   * Predefined: Google Calendar full access + email
   */
  static googleCalendar(): Scopes {
    return Scopes.fromArray([
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ]);
  }

  /**
   * Predefined: Google Calendar readonly + email
   */
  static googleCalendarReadonly(): Scopes {
    return Scopes.fromArray([
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ]);
  }

  /**
   * Check if a specific scope is present
   */
  has(scope: string): boolean {
    return this.scopes.has(scope);
  }

  /**
   * Add a new scope (returns new Scopes instance)
   */
  add(scope: string): Scopes {
    const trimmed = scope.trim();
    if (trimmed.length === 0) {
      return this;
    }

    const newScopes = [...this.scopes, trimmed];
    return new Scopes(newScopes);
  }

  /**
   * Merge with another Scopes instance
   */
  merge(other: Scopes): Scopes {
    const merged = [...this.scopes, ...other.scopes];
    return new Scopes(merged);
  }

  /**
   * Check if contains all given scopes
   */
  containsAll(scopes: string[]): boolean {
    return scopes.every((scope) => this.has(scope));
  }

  /**
   * Get scopes as array (sorted for consistency)
   */
  toArray(): string[] {
    return Array.from(this.scopes).sort();
  }

  /**
   * Convert to space-separated string (OAuth2 format)
   */
  toString(): string {
    return this.toArray().join(" ");
  }

  /**
   * Serialize to JSON
   */
  toJSON(): string[] {
    return this.toArray();
  }

  /**
   * Compare with another Scopes instance
   */
  equals(other: Scopes): boolean {
    if (this.scopes.size !== other.scopes.size) {
      return false;
    }

    return this.toArray().every((scope) => other.has(scope));
  }
}
