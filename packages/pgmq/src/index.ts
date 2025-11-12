/**
 * @systeric/pg-queue
 *
 * PostgreSQL message queue primitives with LISTEN/NOTIFY and work-stealing
 *
 * Phase 1 & 2 Complete:
 * - Domain layer (Value objects, Entities, Errors)
 * - Application layer (Repository ports)
 * - Infrastructure layer (PostgresQueueRepository, SQL generators, Idempotency handler)
 * - Main PgQueue class with auto table creation
 *
 * Features:
 * - Kafka-style topics: Each queue = separate table (systeric_pgqueue_{queueName})
 * - Auto table creation (idempotent)
 * - LISTEN/NOTIFY for instant delivery
 * - FOR UPDATE SKIP LOCKED for work-stealing
 * - DLQ (Dead Letter Queue) support
 * - Retry logic with exponential backoff
 */

// Main queue class
export { PgQueue, type PgQueueConfig } from "./PgQueue";

// Domain value objects
export * from "./domain/vo";

// Domain entities
export * from "./domain/entities";

// Domain errors
export * from "./domain/errors";

// Application ports
export * from "./application/ports";
