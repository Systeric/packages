import { InvalidQueueConfigError } from "../errors";

/**
 * QueueConfig value object
 * Represents configuration for a PostgreSQL message queue
 */

export interface QueueConfigProps {
  tableName: string;
  channelName: string;
  connectionString: string;
  visibilityTimeoutMs?: number;
  pollIntervalMs?: number;
  maxRetries?: number;
}

export class QueueConfig {
  private readonly tableName: string;
  private readonly channelName: string;
  private readonly connectionString: string;
  private readonly visibilityTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly maxRetries: number;

  private constructor(props: Required<QueueConfigProps>) {
    this.tableName = props.tableName;
    this.channelName = props.channelName;
    this.connectionString = props.connectionString;
    this.visibilityTimeoutMs = props.visibilityTimeoutMs;
    this.pollIntervalMs = props.pollIntervalMs;
    this.maxRetries = props.maxRetries;
  }

  static create(props: QueueConfigProps): QueueConfig {
    // Validate table name
    const tableName = props.tableName.trim();
    if (!tableName) {
      throw new InvalidQueueConfigError("Table name cannot be empty");
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new InvalidQueueConfigError(
        "Table name can only contain letters, numbers, and underscores, and must start with a letter or underscore"
      );
    }

    // Validate channel name (protect against SQL injection)
    const channelName = props.channelName.trim();
    if (!channelName) {
      throw new InvalidQueueConfigError("Channel name cannot be empty");
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(channelName)) {
      throw new InvalidQueueConfigError(
        "Channel name can only contain letters, numbers, and underscores, and must start with a letter or underscore"
      );
    }

    // Validate connection string
    const connectionString = props.connectionString.trim();
    if (!connectionString) {
      throw new InvalidQueueConfigError("Connection string cannot be empty");
    }

    // Validate visibility timeout
    const visibilityTimeoutMs = props.visibilityTimeoutMs ?? 300000; // 5 minutes default
    if (visibilityTimeoutMs <= 0) {
      throw new InvalidQueueConfigError("Visibility timeout must be positive");
    }

    // Validate poll interval
    const pollIntervalMs = props.pollIntervalMs ?? 5000;
    if (pollIntervalMs <= 0) {
      throw new InvalidQueueConfigError("Poll interval must be positive");
    }

    // Validate max retries
    const maxRetries = props.maxRetries ?? 3;
    if (maxRetries < 1) {
      throw new InvalidQueueConfigError("Max retries must be at least 1");
    }

    return new QueueConfig({
      tableName,
      channelName,
      connectionString,
      visibilityTimeoutMs,
      pollIntervalMs,
      maxRetries,
    });
  }

  getTableName(): string {
    return this.tableName;
  }

  getChannelName(): string {
    return this.channelName;
  }

  getConnectionString(): string {
    return this.connectionString;
  }

  getVisibilityTimeoutMs(): number {
    return this.visibilityTimeoutMs;
  }

  getPollIntervalMs(): number {
    return this.pollIntervalMs;
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }
}
