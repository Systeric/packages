import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryTokenStore } from "../InMemoryTokenStore";
import { AccessToken } from "../../domain/vo/AccessToken";
import { RefreshToken } from "../../domain/vo/RefreshToken";
import { Scopes } from "../../domain/vo/Scopes";

describe("InMemoryTokenStore", () => {
  let store: InMemoryTokenStore;

  beforeEach(() => {
    store = new InMemoryTokenStore();
  });

  describe("save and get", () => {
    it("should save and retrieve tokens", async () => {
      const tokens = {
        accessToken: AccessToken.fromString("access_token", 3600),
        refreshToken: RefreshToken.fromString("refresh_token"),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user123", tokens);
      const retrieved = await store.get("user123");

      expect(retrieved).toBeDefined();
      expect(retrieved?.userId).toBe("user123");
      expect(retrieved?.accessToken.getValue()).toBe("access_token");
      expect(retrieved?.refreshToken?.getValue()).toBe("refresh_token");
    });

    it("should return undefined for non-existent user", async () => {
      const result = await store.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("should preserve createdAt on updates", async () => {
      const tokens = {
        accessToken: AccessToken.fromString("token1", 3600),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user123", tokens);
      const first = await store.get("user123");

      // Wait a bit then update
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updatedTokens = {
        accessToken: AccessToken.fromString("token2", 3600),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user123", updatedTokens);
      const second = await store.get("user123");

      expect(second?.createdAt).toEqual(first?.createdAt);
      expect(second?.updatedAt).not.toEqual(first?.updatedAt);
      expect(second?.accessToken.getValue()).toBe("token2");
    });
  });

  describe("delete", () => {
    it("should delete tokens", async () => {
      const tokens = {
        accessToken: AccessToken.fromString("token", 3600),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user123", tokens);
      expect(await store.has("user123")).toBe(true);

      await store.delete("user123");
      expect(await store.has("user123")).toBe(false);
      expect(await store.get("user123")).toBeUndefined();
    });

    it("should not throw when deleting non-existent user", async () => {
      await expect(store.delete("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("has", () => {
    it("should return true for existing user", async () => {
      const tokens = {
        accessToken: AccessToken.fromString("token", 3600),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user123", tokens);
      expect(await store.has("user123")).toBe(true);
    });

    it("should return false for non-existent user", async () => {
      expect(await store.has("nonexistent")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all tokens", async () => {
      const tokens = {
        accessToken: AccessToken.fromString("token", 3600),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user1", tokens);
      await store.save("user2", tokens);
      await store.save("user3", tokens);

      expect(store.size()).toBe(3);

      await store.clear();

      expect(store.size()).toBe(0);
      expect(await store.get("user1")).toBeUndefined();
      expect(await store.get("user2")).toBeUndefined();
      expect(await store.get("user3")).toBeUndefined();
    });
  });

  describe("utility methods", () => {
    it("should get all user IDs", async () => {
      const tokens = {
        accessToken: AccessToken.fromString("token", 3600),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user1", tokens);
      await store.save("user2", tokens);
      await store.save("user3", tokens);

      const userIds = store.getUserIds();
      expect(userIds).toHaveLength(3);
      expect(userIds).toContain("user1");
      expect(userIds).toContain("user2");
      expect(userIds).toContain("user3");
    });

    it("should track size correctly", async () => {
      expect(store.size()).toBe(0);

      const tokens = {
        accessToken: AccessToken.fromString("token", 3600),
        scopes: Scopes.googleCalendar(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await store.save("user1", tokens);
      expect(store.size()).toBe(1);

      await store.save("user2", tokens);
      expect(store.size()).toBe(2);

      await store.delete("user1");
      expect(store.size()).toBe(1);

      await store.clear();
      expect(store.size()).toBe(0);
    });
  });
});
