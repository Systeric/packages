import { google } from "googleapis";
import type { AuthAdapter, AuthConfig, TokenResponse } from "../types";
import { AuthConfigSchema } from "../types";

export class GoogleAdapter implements AuthAdapter {
  private oauth2Client;

  constructor(config: AuthConfig) {
    // Validate configuration
    const validated = AuthConfigSchema.parse(config);

    this.oauth2Client = new google.auth.OAuth2(
      validated.clientId,
      validated.clientSecret,
      validated.redirectUri
    );
  }

  getAuthorizationUrl(scopes: string[]): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("Failed to retrieve access token from Google.");
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresIn: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      scope: tokens.scope || "",
      tokenType: tokens.token_type || "Bearer",
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("Failed to retrieve access token during token refresh.");
    }

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || undefined,
      expiresIn: credentials.expiry_date
        ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
        : 3600,
      scope: credentials.scope || "",
      tokenType: credentials.token_type || "Bearer",
    };
  }

  async revokeToken(token: string): Promise<void> {
    await this.oauth2Client.revokeToken(token);
  }
}
