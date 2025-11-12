import type { TokenStore, StoredTokenData } from "./TokenStore";

/**
 * In-memory token store implementation
 *
 * WARNING: Tokens are lost when process restarts.
 * Use only for:
 * - Testing
 * - Development
 * - Single-user applications
 *
 * For production with multiple users, use a database-backed store.
 */
export class InMemoryTokenStore implements TokenStore {
  private tokens = new Map<string, StoredTokenData>();

  // eslint-disable-next-line @typescript-eslint/require-await
  async save(userId: string, tokens: Omit<StoredTokenData, "userId">): Promise<void> {
    const now = new Date();
    this.tokens.set(userId, {
      userId,
      ...tokens,
      updatedAt: now,
      createdAt: this.tokens.get(userId)?.createdAt ?? now,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async get(userId: string): Promise<StoredTokenData | undefined> {
    return this.tokens.get(userId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(userId: string): Promise<void> {
    this.tokens.delete(userId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async has(userId: string): Promise<boolean> {
    return this.tokens.has(userId);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async clear(): Promise<void> {
    this.tokens.clear();
  }

  /**
   * Get all stored user IDs (for testing/debugging)
   */
  getUserIds(): string[] {
    return Array.from(this.tokens.keys());
  }

  /**
   * Get number of stored token sets
   */
  size(): number {
    return this.tokens.size;
  }
}
