import type { AuthAdapter, TokenSet } from "./types";
import type { TokenStore } from "./storage/TokenStore";
import { AccessToken } from "./domain/vo/AccessToken";
import { RefreshToken } from "./domain/vo/RefreshToken";
import { Scopes } from "./domain/vo/Scopes";
import { TokenExpiredError } from "./domain/errors";

/**
 * AuthService - Provider-agnostic OAuth authentication service
 *
 * Features:
 * - Adapter pattern for multiple OAuth providers
 * - Automatic token refresh when expired
 * - Optional token persistence with TokenStore
 * - Type-safe Value Objects for tokens
 *
 * Supports: Google OAuth2, GitHub (future), Microsoft (future)
 */
export class AuthService {
  private adapter: AuthAdapter;
  private store?: TokenStore;

  constructor(adapter: AuthAdapter, store?: TokenStore) {
    this.adapter = adapter;
    this.store = store;
  }

  /**
   * Generate OAuth authorization URL
   * @param scopes - Permission scopes to request
   * @returns Authorization URL for user redirect
   */
  getAuthorizationUrl(scopes: string[]): string {
    return this.adapter.getAuthorizationUrl(scopes);
  }

  /**
   * Exchange authorization code for tokens
   * @param code - Authorization code from OAuth callback
   * @param userId - Optional user ID to store tokens
   * @returns TokenSet with Value Objects
   */
  async exchangeCodeForTokens(code: string, userId?: string): Promise<TokenSet> {
    const response = await this.adapter.exchangeCodeForTokens(code);

    // Convert to TokenSet with Value Objects
    const tokenSet: TokenSet = {
      accessToken: AccessToken.fromString(response.accessToken, response.expiresIn),
      refreshToken: response.refreshToken
        ? RefreshToken.fromString(response.refreshToken)
        : undefined,
      scopes: Scopes.fromString(response.scope),
      tokenType: response.tokenType,
    };

    // Store tokens if userId provided and store available
    if (userId && this.store) {
      await this.store.save(userId, {
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        scopes: tokenSet.scopes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return tokenSet;
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Refresh token string
   * @param userId - Optional user ID to update stored tokens
   * @returns New TokenSet with Value Objects
   */
  async refreshAccessToken(refreshToken: string, userId?: string): Promise<TokenSet> {
    const response = await this.adapter.refreshAccessToken(refreshToken);

    // Convert to TokenSet with Value Objects
    const tokenSet: TokenSet = {
      accessToken: AccessToken.fromString(response.accessToken, response.expiresIn),
      refreshToken: response.refreshToken
        ? RefreshToken.fromString(response.refreshToken)
        : RefreshToken.fromString(refreshToken), // Keep old if not returned
      scopes: Scopes.fromString(response.scope),
      tokenType: response.tokenType,
    };

    // Update stored tokens if userId provided
    if (userId && this.store) {
      await this.store.save(userId, {
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        scopes: tokenSet.scopes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return tokenSet;
  }

  /**
   * Revoke an access or refresh token
   * @param token - Token to revoke
   * @param userId - Optional user ID to remove from store
   */
  async revokeToken(token: string, userId?: string): Promise<void> {
    await this.adapter.revokeToken(token);

    // Remove from store if userId provided
    if (userId && this.store) {
      await this.store.delete(userId);
    }
  }

  /**
   * Get a valid access token for a user, automatically refreshing if needed
   * @param userId - User ID
   * @returns Valid AccessToken
   * @throws TokenExpiredError if token expired and can't refresh
   * @throws Error if no tokens found or store not configured
   */
  async getValidToken(userId: string): Promise<AccessToken> {
    if (!this.store) {
      throw new Error("TokenStore not configured");
    }

    const stored = await this.store.get(userId);
    if (!stored) {
      throw new Error("No tokens found for user");
    }

    const { accessToken, refreshToken } = stored;

    // If token is expired or needs refresh
    if (accessToken.isExpired() || accessToken.needsRefresh()) {
      if (!refreshToken) {
        throw new TokenExpiredError("Token expired and no refresh token available");
      }

      // Refresh the token and return the new access token
      const tokenSet = await this.refreshAccessToken(refreshToken.getValue(), userId);
      return tokenSet.accessToken;
    }

    return accessToken;
  }
}
