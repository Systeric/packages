import { describe, it, expect } from "vitest";
import { QueueConfig } from "./QueueConfig";

describe("QueueConfig", () => {
  const validProps = {
    tableName: "test_queue",
    channelName: "test_channel",
    connectionString: "postgresql://localhost:5432/testdb",
  };

  describe("create", () => {
    it("should create config with valid props", () => {
      const config = QueueConfig.create(validProps);

      expect(config.getTableName()).toBe("test_queue");
      expect(config.getChannelName()).toBe("test_channel");
      expect(config.getConnectionString()).toBe("postgresql://localhost:5432/testdb");
    });

    it("should use default poll interval if not provided", () => {
      const config = QueueConfig.create(validProps);
      expect(config.getPollIntervalMs()).toBe(5000);
    });

    it("should use default max retries if not provided", () => {
      const config = QueueConfig.create(validProps);
      expect(config.getMaxRetries()).toBe(3);
    });

    it("should use default visibility timeout if not provided", () => {
      const config = QueueConfig.create(validProps);
      expect(config.getVisibilityTimeoutMs()).toBe(300000); // 5 minutes
    });

    it("should use custom poll interval if provided", () => {
      const config = QueueConfig.create({
        ...validProps,
        pollIntervalMs: 10000,
      });
      expect(config.getPollIntervalMs()).toBe(10000);
    });

    it("should use custom max retries if provided", () => {
      const config = QueueConfig.create({
        ...validProps,
        maxRetries: 5,
      });
      expect(config.getMaxRetries()).toBe(5);
    });

    it("should use custom visibility timeout if provided", () => {
      const config = QueueConfig.create({
        ...validProps,
        visibilityTimeoutMs: 600000, // 10 minutes
      });
      expect(config.getVisibilityTimeoutMs()).toBe(600000);
    });
  });

  describe("validation", () => {
    it("should throw error for empty table name", () => {
      expect(() => QueueConfig.create({ ...validProps, tableName: "" })).toThrow(
        "Table name cannot be empty"
      );
    });

    it("should throw error for whitespace-only table name", () => {
      expect(() => QueueConfig.create({ ...validProps, tableName: "   " })).toThrow(
        "Table name cannot be empty"
      );
    });

    it("should throw error for empty channel name", () => {
      expect(() => QueueConfig.create({ ...validProps, channelName: "" })).toThrow(
        "Channel name cannot be empty"
      );
    });

    it("should throw error for empty connection string", () => {
      expect(() => QueueConfig.create({ ...validProps, connectionString: "" })).toThrow(
        "Connection string cannot be empty"
      );
    });

    it("should throw error for negative poll interval", () => {
      expect(() => QueueConfig.create({ ...validProps, pollIntervalMs: -1 })).toThrow(
        "Poll interval must be positive"
      );
    });

    it("should throw error for zero poll interval", () => {
      expect(() => QueueConfig.create({ ...validProps, pollIntervalMs: 0 })).toThrow(
        "Poll interval must be positive"
      );
    });

    it("should throw error for maxRetries < 1", () => {
      expect(() => QueueConfig.create({ ...validProps, maxRetries: 0 })).toThrow(
        "Max retries must be at least 1"
      );
    });

    it("should throw error for negative maxRetries", () => {
      expect(() => QueueConfig.create({ ...validProps, maxRetries: -1 })).toThrow(
        "Max retries must be at least 1"
      );
    });

    it("should throw error for negative visibility timeout", () => {
      expect(() => QueueConfig.create({ ...validProps, visibilityTimeoutMs: -1 })).toThrow(
        "Visibility timeout must be positive"
      );
    });

    it("should throw error for zero visibility timeout", () => {
      expect(() => QueueConfig.create({ ...validProps, visibilityTimeoutMs: 0 })).toThrow(
        "Visibility timeout must be positive"
      );
    });

    it("should throw error for invalid table name characters", () => {
      expect(() => QueueConfig.create({ ...validProps, tableName: "table-name!" })).toThrow(
        "Table name can only contain"
      );
    });

    it("should accept valid table name with underscores", () => {
      const config = QueueConfig.create({
        ...validProps,
        tableName: "my_table_name",
      });
      expect(config.getTableName()).toBe("my_table_name");
    });

    it("should accept valid table name with numbers", () => {
      const config = QueueConfig.create({
        ...validProps,
        tableName: "table123",
      });
      expect(config.getTableName()).toBe("table123");
    });
  });
});
