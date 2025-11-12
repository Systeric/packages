import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleAdapter } from "../google-adapter";
import { google } from "googleapis";
import type { AuthConfig } from "../../types";

// Mock the googleapis module
vi.mock("googleapis", () => {
  const mockOAuth2Client = {
    generateAuthUrl: vi.fn(),
    getToken: vi.fn(),
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn(),
    revokeToken: vi.fn(),
  };

  return {
    google: {
      auth: {
        OAuth2: vi.fn(() => mockOAuth2Client),
      },
    },
  };
});

describe("GoogleAdapter", () => {
  let adapter: GoogleAdapter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockOAuth2Client: any;
  const validConfig: AuthConfig = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    redirectUri: "http://localhost:3000/callback",
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create adapter (this will create a new mock OAuth2 client)
    adapter = new GoogleAdapter(validConfig);

    // Get reference to the mocked OAuth2 client
    mockOAuth2Client = new google.auth.OAuth2();
  });

  describe("constructor", () => {
    it("should create adapter with valid config", () => {
      expect(adapter).toBeInstanceOf(GoogleAdapter);
      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        validConfig.clientId,
        validConfig.clientSecret,
        validConfig.redirectUri
      );
    });

    it("should throw error for invalid config - empty clientId", () => {
      expect(() => {
        new GoogleAdapter({
          clientId: "",
          clientSecret: "secret",
          redirectUri: "http://localhost:3000/callback",
        });
      }).toThrow();
    });

    it("should throw error for invalid config - empty clientSecret", () => {
      expect(() => {
        new GoogleAdapter({
          clientId: "client-id",
          clientSecret: "",
          redirectUri: "http://localhost:3000/callback",
        });
      }).toThrow();
    });

    it("should throw error for invalid config - empty redirectUri", () => {
      expect(() => {
        new GoogleAdapter({
          clientId: "client-id",
          clientSecret: "secret",
          redirectUri: "",
        });
      }).toThrow();
    });
  });

  describe("getAuthorizationUrl", () => {
    it("should generate authorization URL with correct parameters", () => {
      const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/userinfo.email",
      ];
      const expectedUrl = "https://accounts.google.com/o/oauth2/v2/auth?...";

      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = adapter.getAuthorizationUrl(scopes);

      expect(url).toBe(expectedUrl);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
      });
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledTimes(1);
    });

    it("should generate authorization URL with empty scopes", () => {
      const expectedUrl = "https://accounts.google.com/o/oauth2/v2/auth?...";
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = adapter.getAuthorizationUrl([]);

      expect(url).toBe(expectedUrl);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: "offline",
        scope: [],
        prompt: "consent",
      });
    });

    it("should generate authorization URL with single scope", () => {
      const scopes = ["https://www.googleapis.com/auth/calendar"];
      const expectedUrl = "https://accounts.google.com/o/oauth2/v2/auth?...";

      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const url = adapter.getAuthorizationUrl(scopes);

      expect(url).toBe(expectedUrl);
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
      });
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("should exchange authorization code for tokens", async () => {
      const code = "test-auth-code";
      const mockTokens = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() + 3600 * 1000, // 1 hour from now
        scope: "https://www.googleapis.com/auth/calendar",
        token_type: "Bearer",
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await adapter.exchangeCodeForTokens(code);

      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code);
      expect(mockOAuth2Client.getToken).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        accessToken: mockTokens.access_token,
        refreshToken: mockTokens.refresh_token,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresIn: expect.any(Number),
        scope: mockTokens.scope,
        tokenType: mockTokens.token_type,
      });
      // Verify expiresIn is approximately 3600 seconds (allow 5 second variance)
      expect(result.expiresIn).toBeGreaterThan(3595);
      expect(result.expiresIn).toBeLessThanOrEqual(3600);
    });

    it("should handle tokens without refresh token", async () => {
      const code = "test-auth-code";
      const mockTokens = {
        access_token: "test-access-token",
        expiry_date: Date.now() + 3600 * 1000,
        scope: "https://www.googleapis.com/auth/calendar",
        token_type: "Bearer",
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await adapter.exchangeCodeForTokens(code);

      expect(result.refreshToken).toBeUndefined();
      expect(result.accessToken).toBe(mockTokens.access_token);
    });

    it("should handle tokens without expiry date (default to 3600s)", async () => {
      const code = "test-auth-code";
      const mockTokens = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        scope: "https://www.googleapis.com/auth/calendar",
        token_type: "Bearer",
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await adapter.exchangeCodeForTokens(code);

      expect(result.expiresIn).toBe(3600);
    });

    it("should handle tokens without scope", async () => {
      const code = "test-auth-code";
      const mockTokens = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() + 3600 * 1000,
        token_type: "Bearer",
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await adapter.exchangeCodeForTokens(code);

      expect(result.scope).toBe("");
    });

    it("should handle tokens without token_type (default to Bearer)", async () => {
      const code = "test-auth-code";
      const mockTokens = {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() + 3600 * 1000,
        scope: "https://www.googleapis.com/auth/calendar",
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await adapter.exchangeCodeForTokens(code);

      expect(result.tokenType).toBe("Bearer");
    });

    it("should throw error when access token is missing", async () => {
      const code = "test-auth-code";
      const mockTokens = {
        refresh_token: "test-refresh-token",
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      await expect(adapter.exchangeCodeForTokens(code)).rejects.toThrow(
        "Failed to retrieve access token from Google."
      );
    });

    it("should propagate Google API errors", async () => {
      const code = "invalid-code";
      const googleError = new Error("invalid_grant");

      mockOAuth2Client.getToken.mockRejectedValue(googleError);

      await expect(adapter.exchangeCodeForTokens(code)).rejects.toThrow("invalid_grant");
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh access token successfully", async () => {
      const refreshToken = "test-refresh-token";
      const mockCredentials = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expiry_date: Date.now() + 3600 * 1000,
        scope: "https://www.googleapis.com/auth/calendar",
        token_type: "Bearer",
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await adapter.refreshAccessToken(refreshToken);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: refreshToken,
      });
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        accessToken: mockCredentials.access_token,
        refreshToken: mockCredentials.refresh_token,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresIn: expect.any(Number),
        scope: mockCredentials.scope,
        tokenType: mockCredentials.token_type,
      });
      expect(result.expiresIn).toBeGreaterThan(3595);
      expect(result.expiresIn).toBeLessThanOrEqual(3600);
    });

    it("should handle refresh without new refresh token", async () => {
      const refreshToken = "test-refresh-token";
      const mockCredentials = {
        access_token: "new-access-token",
        expiry_date: Date.now() + 3600 * 1000,
        scope: "https://www.googleapis.com/auth/calendar",
        token_type: "Bearer",
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await adapter.refreshAccessToken(refreshToken);

      expect(result.refreshToken).toBeUndefined();
      expect(result.accessToken).toBe(mockCredentials.access_token);
    });

    it("should handle refresh without expiry date (default to 3600s)", async () => {
      const refreshToken = "test-refresh-token";
      const mockCredentials = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        scope: "https://www.googleapis.com/auth/calendar",
        token_type: "Bearer",
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await adapter.refreshAccessToken(refreshToken);

      expect(result.expiresIn).toBe(3600);
    });

    it("should handle refresh without scope", async () => {
      const refreshToken = "test-refresh-token";
      const mockCredentials = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expiry_date: Date.now() + 3600 * 1000,
        token_type: "Bearer",
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await adapter.refreshAccessToken(refreshToken);

      expect(result.scope).toBe("");
    });

    it("should handle refresh without token_type (default to Bearer)", async () => {
      const refreshToken = "test-refresh-token";
      const mockCredentials = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expiry_date: Date.now() + 3600 * 1000,
        scope: "https://www.googleapis.com/auth/calendar",
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      const result = await adapter.refreshAccessToken(refreshToken);

      expect(result.tokenType).toBe("Bearer");
    });

    it("should throw error when access token is missing after refresh", async () => {
      const refreshToken = "test-refresh-token";
      const mockCredentials = {
        refresh_token: "new-refresh-token",
      };

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: mockCredentials,
      });

      await expect(adapter.refreshAccessToken(refreshToken)).rejects.toThrow(
        "Failed to retrieve access token during token refresh."
      );
    });

    it("should propagate Google API errors on invalid refresh token", async () => {
      const refreshToken = "invalid-refresh-token";
      const googleError = new Error("invalid_grant");

      mockOAuth2Client.refreshAccessToken.mockRejectedValue(googleError);

      await expect(adapter.refreshAccessToken(refreshToken)).rejects.toThrow("invalid_grant");
    });
  });

  describe("revokeToken", () => {
    it("should revoke token successfully", async () => {
      const token = "test-token-to-revoke";

      mockOAuth2Client.revokeToken.mockResolvedValue(undefined);

      await adapter.revokeToken(token);

      expect(mockOAuth2Client.revokeToken).toHaveBeenCalledWith(token);
      expect(mockOAuth2Client.revokeToken).toHaveBeenCalledTimes(1);
    });

    it("should propagate Google API errors on revocation failure", async () => {
      const token = "invalid-token";
      const googleError = new Error("invalid_token");

      mockOAuth2Client.revokeToken.mockRejectedValue(googleError);

      await expect(adapter.revokeToken(token)).rejects.toThrow("invalid_token");
    });

    it("should handle network errors during revocation", async () => {
      const token = "test-token";
      const networkError = new Error("Network request failed");

      mockOAuth2Client.revokeToken.mockRejectedValue(networkError);

      await expect(adapter.revokeToken(token)).rejects.toThrow("Network request failed");
    });
  });
});
