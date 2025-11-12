import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { QueueError } from "../errors";

/**
 * MessageId value object
 * Represents a unique identifier for queue messages
 */
export class MessageId {
  private constructor(private readonly value: string) {}

  /**
   * Generate a new UUID v4 MessageId
   */
  static generate(): MessageId {
    return new MessageId(uuidv4());
  }

  /**
   * Create MessageId from existing UUID string
   * @throws QueueError if the string is not a valid UUID
   */
  static fromString(value: string): MessageId {
    if (!value || !uuidValidate(value)) {
      throw new QueueError("Invalid message ID format");
    }
    return new MessageId(value);
  }

  /**
   * Get the raw UUID string value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Compare equality with another MessageId
   */
  equals(other: MessageId): boolean {
    return this.value === other.value;
  }

  /**
   * Return string representation
   */
  toString(): string {
    return this.value;
  }
}
