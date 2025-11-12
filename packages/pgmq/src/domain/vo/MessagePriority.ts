import { z } from "zod";
import { QueueError } from "../errors";

const prioritySchema = z.number().int().min(1).max(10);

/**
 * MessagePriority value object
 * Represents message processing priority (1 = highest, 10 = lowest)
 */
export class MessagePriority {
  private constructor(private readonly value: number) {}

  static readonly URGENT = new MessagePriority(1);
  static readonly HIGH = new MessagePriority(3);
  static readonly NORMAL = new MessagePriority(5);
  static readonly LOW = new MessagePriority(8);

  /**
   * Create priority with custom value (1-10)
   * @throws QueueError if value is out of range
   */
  static create(value: number): MessagePriority {
    const result = prioritySchema.safeParse(value);
    if (!result.success) {
      const message = result.error.errors.map((e) => e.message).join(", ");
      throw new QueueError(`Invalid priority: ${message}`);
    }
    return new MessagePriority(result.data);
  }

  /**
   * Alias for create()
   */
  static fromNumber(value: number): MessagePriority {
    return MessagePriority.create(value);
  }

  getValue(): number {
    return this.value;
  }

  equals(other: MessagePriority): boolean {
    return this.value === other.value;
  }

  /**
   * Compare priorities (lower number = higher priority)
   * Returns: negative if this < other, positive if this > other, 0 if equal
   */
  compareTo(other: MessagePriority): number {
    return this.value - other.value;
  }
}
