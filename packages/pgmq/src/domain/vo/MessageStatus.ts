import { z } from "zod";
import { QueueError } from "../errors";

const messageStatusSchema = z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "DEAD_LETTER"]);

type MessageStatusValue = z.infer<typeof messageStatusSchema>;

/**
 * MessageStatus value object
 * Represents the lifecycle state of a queue message
 */
export class MessageStatus {
  private constructor(private readonly value: MessageStatusValue) {}

  static readonly PENDING = new MessageStatus("PENDING");
  static readonly PROCESSING = new MessageStatus("PROCESSING");
  static readonly COMPLETED = new MessageStatus("COMPLETED");
  static readonly FAILED = new MessageStatus("FAILED");
  static readonly DEAD_LETTER = new MessageStatus("DEAD_LETTER");

  /**
   * Create MessageStatus from string
   * @throws QueueError if the string is not a valid status
   */
  static fromString(value: string): MessageStatus {
    const result = messageStatusSchema.safeParse(value);
    if (!result.success) {
      throw new QueueError("Invalid message status");
    }
    return new MessageStatus(result.data);
  }

  isPending(): boolean {
    return this.value === "PENDING";
  }

  isProcessing(): boolean {
    return this.value === "PROCESSING";
  }

  isCompleted(): boolean {
    return this.value === "COMPLETED";
  }

  isFailed(): boolean {
    return this.value === "FAILED";
  }

  isDeadLetter(): boolean {
    return this.value === "DEAD_LETTER";
  }

  equals(other: MessageStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
