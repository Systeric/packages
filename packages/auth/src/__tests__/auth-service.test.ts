import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../auth-service";
import type { AuthAdapter } from "../types";
import { InMemoryTokenStore } from "../storage/InMemoryTokenStore";
import { AccessToken } from "../domain/vo/AccessToken";
import { RefreshToken } from "../domain/vo/RefreshToken";
import { Scopes } from "../domain/vo/Scopes";
import { TokenExpiredError } from "../domain/errors";

// Mock adapter
class MockAuthAdapter implements AuthAdapter {
  getAuthorizationUrl = vi.fn((scopes: string[]) => {
    return `https://oauth.example.com/auth?scopes=${scopes.join(",")}`;
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  exchangeCodeForTokens = vi.fn(async (code: string) => {
    if (code === "invalid") {
      throw new Error("Invalid code");
    }
    return {
      accessToken: "access_token_123",
      refreshToken: "refresh_token_456",
      expiresIn: 3600,
      scope: "scope1 scope2",
      tokenType: "Bearer",
    };
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  refreshAccessToken = vi.fn(async (refreshToken: string) => {
    if (refreshToken === "invalid") {
      throw new Error("Invalid refresh token");
    }
    return {
      accessToken: "new_access_token",
      refreshToken: "new_refresh_token",
      expiresIn: 3600,
      scope: "scope1 scope2",
      tokenType: "Bearer",
    };
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  revokeToken = vi.fn(async (token: string) => {
    if (token === "invalid") {
      throw new Error("Invalid token");
    }
  });
}

describe("AuthService", () => {
  let adapter: MockAuthAdapter;
  let store: InMemoryTokenStore;
  let service: AuthService;

  beforeEach(() => {
    adapter = new MockAuthAdapter();
    store = new InMemoryTokenStore();
    service = new AuthService(adapter, store);
  });

  describe("getAuthorizationUrl", () => {
    it("should generate authorization URL", () => {
      const url = service.getAuthorizationUrl(["scope1", "scope2"]);

      expect(url).toContain("scope1");
      expect(url).toContain("scope2");
      expect(adapter.getAuthorizationUrl).toHaveBeenCalledWith(["scope1", "scope2"]);
    });
  });

  describe("exchangeCodeForTokens", () => {
    it("should exchange code for tokens", async () => {
      const result = await service.exchangeCodeForTokens("valid_code");

      expect(result.accessToken.getValue()).toBe("access_token_123");
      expect(result.refreshToken?.getValue()).toBe("refresh_token_456");
      expect(result.scopes.toString()).toBe("scope1 scope2");
      expect(result.tokenType).toBe("Bearer");
      expect(adapter.exchangeCodeForTokens).toHaveBeenCalledWith("valid_code");
    });

    it("should throw on invalid code", async () => {
      await expect(service.exchangeCodeForTokens("invalid")).rejects.toThrow();
    });

    it("should store tokens when userId provided", async () => {
      await service.exchangeCodeForTokens("valid_code", "user123");

      const stored = await store.get("user123");
      expect(stored).toBeDefined();
      expect(stored?.accessToken.getValue()).toBe("access_token_123");
    });
  });

  describe("refreshAccessToken", () => {
    it("should refresh access token", async () => {
      const result = await service.refreshAccessToken("refresh_token_456");

      expect(result.accessToken.getValue()).toBe("new_access_token");
      expect(result.refreshToken?.getValue()).toBe("new_refresh_token");
      expect(result.scopes.toString()).toBe("scope1 scope2");
      expect(result.tokenType).toBe("Bearer");
      expect(adapter.refreshAccessToken).toHaveBeenCalledWith("refresh_token_456");
    });

    it("should throw on invalid refresh token", async () => {
      await expect(service.refreshAccessToken("invalid")).rejects.toThrow();
    });

    it("should update stored tokens when userId provided", async () => {
      // Store initial tokens
      await store.save("user123", {
        accessToken: AccessToken.fromString("old_token", 3600),
        refreshToken: RefreshToken.fromString("refresh_token_456"),
        scopes: Scopes.fromArray(["scope1"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Refresh
      await service.refreshAccessToken("refresh_token_456", "user123");

      // Check updated
      const stored = await store.get("user123");
      expect(stored?.accessToken.getValue()).toBe("new_access_token");
    });
  });

  describe("revokeToken", () => {
    it("should revoke token", async () => {
      await service.revokeToken("token_to_revoke");

      expect(adapter.revokeToken).toHaveBeenCalledWith("token_to_revoke");
    });

    it("should remove tokens from store when userId provided", async () => {
      // Store tokens
      await store.save("user123", {
        accessToken: AccessToken.fromString("token", 3600),
        scopes: Scopes.fromArray(["scope1"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Revoke
      await service.revokeToken("token", "user123");

      // Check removed
      expect(await store.has("user123")).toBe(false);
    });
  });

  describe("getValidToken", () => {
    it("should return valid token", async () => {
      await store.save("user123", {
        accessToken: AccessToken.fromString("valid_token", 3600),
        refreshToken: RefreshToken.fromString("refresh_token"),
        scopes: Scopes.fromArray(["scope1"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const token = await service.getValidToken("user123");
      expect(token.getValue()).toBe("valid_token");
    });

    it("should auto-refresh when token needs refresh", async () => {
      await store.save("user123", {
        accessToken: AccessToken.fromString("expiring_token", 200), // < 5 min
        refreshToken: RefreshToken.fromString("refresh_token"),
        scopes: Scopes.fromArray(["scope1"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const token = await service.getValidToken("user123");

      // Should have refreshed
      expect(adapter.refreshAccessToken).toHaveBeenCalled();
      expect(token.getValue()).toBe("new_access_token");
    });

    it("should throw when no tokens found", async () => {
      await expect(service.getValidToken("nonexistent")).rejects.toThrow(
        "No tokens found for user"
      );
    });

    it("should throw when token expired and no refresh token", async () => {
      await store.save("user123", {
        accessToken: AccessToken.fromString("expired", 0),
        // No refresh token
        scopes: Scopes.fromArray(["scope1"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.getValidToken("user123")).rejects.toThrow(TokenExpiredError);
    });
  });

  describe("without TokenStore", () => {
    beforeEach(() => {
      service = new AuthService(adapter); // No store
    });

    it("should work for stateless operations", async () => {
      const url = service.getAuthorizationUrl(["scope1"]);
      expect(url).toBeDefined();

      const tokens = await service.exchangeCodeForTokens("valid_code");
      expect(tokens).toBeDefined();
    });

    it("should throw when trying to use store-dependent methods", async () => {
      await expect(service.getValidToken("user123")).rejects.toThrow("TokenStore not configured");
    });
  });
});
