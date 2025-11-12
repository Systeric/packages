import { z } from "zod";
import type { AccessToken } from "./domain/vo/AccessToken";
import type { RefreshToken } from "./domain/vo/RefreshToken";
import type { Scopes } from "./domain/vo/Scopes";

export const AuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

/**
 * Legacy token response (for backwards compatibility)
 * @deprecated Use TokenSet instead for better type safety
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}

/**
 * Token set using Value Objects for better type safety
 */
export interface TokenSet {
  accessToken: AccessToken;
  refreshToken?: RefreshToken;
  scopes: Scopes;
  tokenType: string;
}

/**
 * OAuth provider adapter interface
 * Implement this interface to add support for new OAuth providers (GitHub, Microsoft, etc.)
 */
export interface AuthAdapter {
  /**
   * Generate OAuth authorization URL for user consent
   * @param scopes - Array of permission scopes
   * @returns Authorization URL to redirect user to
   */
  getAuthorizationUrl(scopes: string[]): string;

  /**
   * Exchange authorization code for access and refresh tokens
   * @param code - Authorization code from OAuth callback
   * @returns Token response with access token and optional refresh token
   */
  exchangeCodeForTokens(code: string): Promise<TokenResponse>;

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Previously obtained refresh token
   * @returns New token response
   */
  refreshAccessToken(refreshToken: string): Promise<TokenResponse>;

  /**
   * Revoke an access or refresh token
   * @param token - Token to revoke
   */
  revokeToken(token: string): Promise<void>;
}
