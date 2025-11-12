import type { AccessToken } from "../domain/vo/AccessToken";
import type { RefreshToken } from "../domain/vo/RefreshToken";
import type { Scopes } from "../domain/vo/Scopes";

/**
 * Token data for storage
 */
export interface StoredTokenData {
  userId: string;
  accessToken: AccessToken;
  refreshToken?: RefreshToken;
  scopes: Scopes;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TokenStore interface for persisting OAuth tokens
 *
 * Implementations can use different storage backends:
 * - In-memory (for testing)
 * - Database (PostgreSQL, Redis)
 * - Encrypted file storage
 * - Session storage
 */
export interface TokenStore {
  /**
   * Store tokens for a user
   * @param userId - Unique user identifier
   * @param tokens - Token data to store
   */
  save(userId: string, tokens: Omit<StoredTokenData, "userId">): Promise<void>;

  /**
   * Retrieve tokens for a user
   * @param userId - Unique user identifier
   * @returns Token data or undefined if not found
   */
  get(userId: string): Promise<StoredTokenData | undefined>;

  /**
   * Delete tokens for a user
   * @param userId - Unique user identifier
   */
  delete(userId: string): Promise<void>;

  /**
   * Check if tokens exist for a user
   * @param userId - Unique user identifier
   */
  has(userId: string): Promise<boolean>;

  /**
   * Clear all tokens (for testing/maintenance)
   */
  clear(): Promise<void>;
}
