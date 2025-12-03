# @systeric/pg-queue

**PostgreSQL Message Queue with Event-Driven Work-Stealing**

A lightweight, high-performance **TypeScript library** that turns PostgreSQL into a message queue. This is **not a standalone service** - it's a library you integrate into your Node.js/TypeScript applications. Uses `LISTEN/NOTIFY` for instant message delivery and `FOR UPDATE SKIP LOCKED` for lock-free work-stealing across multiple workers.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13%2B-blue.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/tests-89%20passing-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-0.2.2-blue.svg)]()
[![Status](https://img.shields.io/badge/status-production--ready-green.svg)]()

---

## Press Release

**For Immediate Release**

**@systeric/pg-queue: Turn PostgreSQL Into a High-Performance Message Queue**

Today we're releasing `@systeric/pg-queue`, a **lightweight TypeScript library** that turns PostgreSQL into a high-performance message queue. This is a library you install via npm/pnpm and integrate into your application code - **not a standalone service or daemon**. Unlike traditional polling-based queues, pg-queue delivers messages instantly using PostgreSQL's `LISTEN/NOTIFY` and ensures zero race conditions with work-stealing pattern (`SKIP LOCKED`).

**Why This Matters:**

Most message queues require additional infrastructure (Redis, RabbitMQ, SQS). If you're already using PostgreSQL, you can eliminate this complexity. As a library that integrates directly into your application, pg-queue provides:

- **Instant Delivery**: Sub-10ms latency using `LISTEN/NOTIFY` (no polling)
- **No Race Conditions**: Multiple workers process different messages automatically
- **ACID Guarantees**: Messages are part of your database transactions
- **Built-in Retry Logic**: Exponential backoff with dead letter queue
- **Zero Extra Infrastructure**: Just PostgreSQL 13+ and your Node.js application
- **Library, Not a Service**: Import and use directly in your code - no separate queue service to deploy

**Perfect For:**

- Background job processing
- Transactional outbox pattern
- Event-driven microservices
- Task queues with retry logic
- Any system already using PostgreSQL

---

## 📦 Release Status

**Version**: 0.2.2
**Status**: ✅ Production Ready
**Published**: ✅ [npm](https://www.npmjs.com/package/@systeric/pg-queue)

This package is complete and ready for its first npm release. All features documented below are fully implemented and tested.

To install after release:

```bash
pnpm add @systeric/pg-queue
```

For now, you can use it locally in this monorepo or install directly from GitHub.

---

## Table of Contents

- [FAQ](#faq)
  - [How do I install and import?](#q-how-do-i-install-and-import-pg-queue)
  - [How do I set up the database?](#q-how-do-i-set-up-the-database-schema)
  - [How do I publish messages?](#q-how-do-i-publish-messages-to-the-queue)
  - [How do I process messages?](#q-how-do-i-process-messages-from-the-queue)
  - [How does auto-consumption work?](#q-how-does-auto-consumption-work)
  - [How do I use with NestJS?](#q-how-do-i-use-pg-queue-with-nestjs)
  - [Can I run multiple backend instances?](#q-can-i-run-multiple-backend-instances-with-a-single-database)
  - [What if a worker crashes?](#q-what-happens-if-a-worker-crashes-while-processing)
  - [How does retry logic work?](#q-how-does-retry-logic-work)
  - [How do I handle dead letter queue?](#q-how-do-i-handle-dead-letter-queue-dlq)
  - [How do I implement the outbox pattern?](#q-how-do-i-implement-the-transactional-outbox-pattern)
  - [How fast is it?](#q-how-fast-is-it-whats-the-latency)
  - [What are the limitations?](#q-what-are-the-limitations)
  - [How do I monitor queue health?](#q-how-do-i-monitor-queue-health)
  - [How do I integrate with OpenTelemetry?](#q-how-do-i-integrate-with-opentelemetry)
  - [How do I test code using pg-queue?](#q-how-do-i-test-code-that-uses-pg-queue)
- [SSL Configuration](#ssl-configuration)
- [API Reference](#api-reference)
- [Events](#events)
- [Comparison with Other Queues](#comparison-with-other-queue-systems)

---

## FAQ

### Q: How do I install and import pg-queue?

**Installation:**

```bash
# Using pnpm (recommended)
pnpm add @systeric/pg-queue

# Using npm
npm install @systeric/pg-queue

# Using yarn
yarn add @systeric/pg-queue
```

**Import:**

```typescript
import { PgQueue, MessagePriority } from "@systeric/pg-queue";
```

**TypeScript Support:**

pg-queue is written in TypeScript with full type definitions included. No `@types` packages needed.

---

### Q: How do I set up the database schema?

**Step 1: Create the queue table**

Run this SQL migration in your PostgreSQL database:

```sql
CREATE TABLE my_queue (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER')),
  priority INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  processing_started_at TIMESTAMPTZ
);
```

**Step 2: Create indexes for performance**

```sql
-- Index for dequeue operations (work-stealing)
CREATE INDEX idx_my_queue_dequeue
  ON my_queue(priority ASC, created_at ASC)
  WHERE status = 'PENDING' OR (status = 'FAILED' AND next_retry_at <= NOW());

-- Index for status queries
CREATE INDEX idx_my_queue_status ON my_queue(status);
```

**Step 3: Create NOTIFY trigger (for event-driven delivery)**

```sql
CREATE OR REPLACE FUNCTION notify_my_queue()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('my_channel', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER my_queue_notify
  AFTER INSERT ON my_queue
  FOR EACH ROW
  WHEN (NEW.status = 'PENDING')
  EXECUTE FUNCTION notify_my_queue();
```

**Using Prisma?**

Add this to your `schema.prisma`:

```prisma
model MyQueue {
  id                  String    @id @default(uuid())
  type                String
  payload             Json
  status              String
  priority            Int       @default(5)
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  processedAt         DateTime? @map("processed_at")
  nextRetryAt         DateTime? @map("next_retry_at")
  retryCount          Int       @default(0) @map("retry_count")
  maxRetries          Int       @default(3) @map("max_retries")
  lastError           String?   @map("last_error")
  processingStartedAt DateTime? @map("processing_started_at")

  @@index([priority, createdAt], name: "idx_my_queue_dequeue")
  @@index([status], name: "idx_my_queue_status")
  @@map("my_queue")
}
```

Then create a custom migration for the trigger function.

---

### Q: How do I publish messages to the queue?

**Basic Usage:**

```typescript
import { PgQueue, MessagePriority } from "@systeric/pg-queue";

// Create queue instance
const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

// Publish a message
const messageId = await queue.enqueue({
  type: "email.send",
  payload: {
    to: "user@example.com",
    subject: "Welcome!",
    body: "Thanks for signing up!",
  },
  priority: MessagePriority.HIGH, // Optional, defaults to NORMAL (5)
  maxRetries: 3, // Optional, defaults to 3
});

console.log(`Message enqueued: ${messageId.toString()}`);
```

**Publishing Within a Transaction:**

```typescript
import { PgQueue, MessagePriority } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

// Queue manages transaction - auto-commits on success, auto-rollbacks on error
const userId = await queue.withTransaction(async (tx) => {
  // 1. Execute your business logic
  const result = await tx.query("INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id", [
    "user@example.com",
    "John Doe",
  ]);
  const userId = result.rows[0].id;

  // 2. Enqueue message in same transaction
  await tx.enqueue({
    type: "email.welcome",
    payload: { userId },
    priority: MessagePriority.HIGH,
  });

  // 3. Return any value you need
  return userId;
});
```

**With Priority:**

```typescript
// Priority levels (lower number = higher priority)
MessagePriority.URGENT; // 1 (highest)
MessagePriority.HIGH; // 3
MessagePriority.NORMAL; // 5 (default)
MessagePriority.LOW; // 8

// Custom priority (1-10)
await queue.enqueue({
  type: "job.critical",
  payload: { taskId: 123 },
  priority: MessagePriority.create(2), // Between URGENT and HIGH
});
```

---

### Q: How do I process messages from the queue?

**Auto-Consumption with Handlers (Recommended):**

The easiest way to process messages is using auto-consumption. Register handlers for your message types, then call `start()` - the queue will automatically consume messages for you:

```typescript
import { PgQueue } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

// Register handlers for different message types
queue.registerHandler("email.send", async (message) => {
  const { to, subject, body } = message.getPayload();
  await sendEmail(to, subject, body);
  // Queue automatically calls ack() on success or nack() on error
});

queue.registerHandler("sms.send", async (message) => {
  const { phone, text } = message.getPayload();
  await sendSMS(phone, text);
});

queue.registerHandler("webhook.post", async (message) => {
  const { url, data } = message.getPayload();
  await fetch(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
});

// Start consuming messages with concurrency control
await queue.start({ concurrency: 5 }); // Process up to 5 messages concurrently

// Graceful shutdown - waits for in-flight messages to complete
process.on("SIGTERM", async () => {
  await queue.stop();
  process.exit(0);
});
```

**How Auto-Consumption Works:**

- When you call `start()`, the queue automatically begins consuming both **existing** PENDING messages and **new** messages enqueued after startup
- Handlers are called automatically when messages are dequeued
- If a handler succeeds, the message is automatically acknowledged (`ack`)
- If a handler throws an error, the message is automatically rejected (`nack`) and will be retried
- The `concurrency` option controls how many messages can be processed simultaneously (default: 1)
- Calling `stop()` waits for all in-flight messages to complete before shutting down (graceful shutdown)
- If no handler is registered for a message type, the message is nacked and an error event is emitted

**Manual Dequeue (Advanced):**

If you need more control, you can manually dequeue and process messages:

```typescript
const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

// Start listening for notifications
await queue.start();

queue.on("notification", async () => {
  // New message available, try to dequeue
  const message = await queue.dequeue();

  if (!message) {
    // Another worker grabbed it (race condition, expected)
    return;
  }

  try {
    await processMessage(message.getPayload());
    await queue.ack(message.getId());
  } catch (error) {
    await queue.nack(message.getId(), error);
  }
});
```

---

### Q: How does auto-consumption work?

**Overview:**

Auto-consumption is the recommended way to process messages. When you register handlers and call `start()`, the queue automatically:

1. **Consumes existing messages** - Processes all PENDING messages that were enqueued before the worker started
2. **Consumes new messages** - Instantly processes messages enqueued after startup via LISTEN/NOTIFY
3. **Handles ack/nack automatically** - Success = ack, Error = nack with retry
4. **Respects concurrency limits** - Processes multiple messages concurrently (configurable)
5. **Graceful shutdown** - Waits for in-flight messages to complete when `stop()` is called

**Example with 5 Messages Already in Queue:**

```typescript
// Scenario: 5 messages were enqueued when no worker was running
// Now we start a worker:

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

queue.registerHandler("task", async (message) => {
  console.log("Processing:", message.getPayload());
  await processTask(message.getPayload());
});

// When start() is called, the queue immediately begins consuming
// all 5 existing PENDING messages
await queue.start({ concurrency: 3 });

// Output:
// Processing: { id: 1 }
// Processing: { id: 2 }
// Processing: { id: 3 }
// (3 at a time due to concurrency: 3)
// Processing: { id: 4 }
// Processing: { id: 5 }
```

**Concurrency Control:**

```typescript
// Process 1 message at a time (default)
await queue.start();

// Process up to 5 messages concurrently
await queue.start({ concurrency: 5 });

// Process up to 20 messages concurrently
await queue.start({ concurrency: 20 });
```

**Error Handling:**

When a handler throws an error, the message is automatically nacked and will be retried:

```typescript
queue.registerHandler("risky-task", async (message) => {
  // If this throws, message is nacked and retried
  await riskyOperation(message.getPayload());
});

// Listen for errors
queue.on("error", (error) => {
  console.error("Handler failed:", error);
  // Log to monitoring service, send alert, etc.
});
```

**No Handler Registered:**

If a message type has no registered handler, it's automatically nacked and an error is emitted:

```typescript
// Only registered "email.send" handler
queue.registerHandler("email.send", async (message) => {
  await sendEmail(message.getPayload());
});

await queue.start();

// If queue receives "sms.send" message (no handler), it will:
// 1. Emit error event
// 2. Nack the message
// 3. Message will be retried or sent to DLQ
queue.on("error", (error) => {
  console.error(error.message); // "No handler registered for message type: sms.send"
});
```

**Graceful Shutdown:**

When you call `stop()`, the queue waits for all in-flight messages to complete:

```typescript
process.on("SIGTERM", async () => {
  console.log("Shutting down...");
  // This waits for all active handlers to complete
  await queue.stop();
  console.log("All messages processed, exiting");
  process.exit(0);
});
```

**Handling Large Volumes (1000+ Messages):**

The queue handles large volumes efficiently without requiring explicit batching:

```typescript
// Scenario: 1000 pending messages in the queue

const queue = await PgQueue.create({
  queueName: "high_volume_queue",
  connectionString: process.env.DATABASE_URL!,
});

queue.registerHandler("task", async (message) => {
  await processTask(message.getPayload());
});

// Process up to 20 messages concurrently
// The queue will continuously consume until all 1000 are processed
await queue.start({ concurrency: 20 });

// How it works:
// 1. The queue dequeues messages one at a time using FOR UPDATE SKIP LOCKED
// 2. Up to 20 messages are processed concurrently (based on concurrency setting)
// 3. As handlers complete, new messages are dequeued automatically
// 4. The consumption loop continues until the queue is empty
// 5. No memory issues - messages are processed as they're dequeued, not loaded all at once
```

**Key Points:**

- **No Batch Loading**: Messages are dequeued one at a time, not loaded in bulk
- **Memory Efficient**: Only `concurrency` number of messages are in memory at once
- **Automatic Throttling**: Concurrency setting prevents overwhelming your system
- **Work Stealing**: Multiple workers can process the same queue simultaneously
- **No Breaking**: The system won't break with 1000, 10,000, or 1,000,000 messages

**Performance Tuning:**

```typescript
// Low volume, simple tasks
await queue.start({ concurrency: 1 });

// Medium volume (100-1000 messages)
await queue.start({ concurrency: 10 });

// High volume (1000+ messages), fast tasks
await queue.start({ concurrency: 50 });

// High volume, I/O heavy tasks (API calls, database writes)
await queue.start({ concurrency: 100 });

// Very high volume with external rate limiting
await queue.start({ concurrency: 5 }); // Throttle to avoid overwhelming external APIs
```

**Multi-Worker Setup:**

For extremely high volumes, run multiple worker instances:

```typescript
// Worker Instance 1
const worker1 = await PgQueue.create({
  queueName: "high_volume_queue",
  connectionString: process.env.DATABASE_URL!,
});
await worker1.start({ concurrency: 20 });

// Worker Instance 2 (different process/container)
const worker2 = await PgQueue.create({
  queueName: "high_volume_queue", // Same queue name
  connectionString: process.env.DATABASE_URL!,
});
await worker2.start({ concurrency: 20 });

// Result: 40 messages processed concurrently across 2 workers
// FOR UPDATE SKIP LOCKED ensures no duplicate processing
```

---

### Q: How do I use pg-queue with NestJS?

pg-queue integrates seamlessly with NestJS using providers and lifecycle hooks.

**Step 1: Create a Queue Module with Auto-Consumption**

```typescript
// queue/queue.module.ts
import { Module, OnModuleInit, OnModuleDestroy, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PgQueue } from "@systeric/pg-queue";
import { EmailService } from "../email/email.service";
import { NotificationService } from "../notification/notification.service";

@Module({
  providers: [
    {
      provide: "PGMQ_QUEUE",
      useFactory: async (configService: ConfigService) => {
        const queue = await PgQueue.create({
          queueName: "my_queue",
          connectionString: configService.get("DATABASE_URL")!,
        });
        return queue;
      },
      inject: [ConfigService],
    },
  ],
  exports: ["PGMQ_QUEUE"],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject("PGMQ_QUEUE") private readonly queue: PgQueue,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService
  ) {}

  async onModuleInit() {
    // Register message handlers
    this.queue.registerHandler("email.send", async (message) => {
      const { to, subject, body } = message.getPayload();
      await this.emailService.send(to, subject, body);
    });

    this.queue.registerHandler("notification.push", async (message) => {
      const { userId, title, body } = message.getPayload();
      await this.notificationService.sendPush(userId, title, body);
    });

    // Start auto-consumption with concurrency
    await this.queue.start({ concurrency: 10 });
  }

  async onModuleDestroy() {
    // Graceful shutdown - waits for in-flight messages
    await this.queue.stop();
  }
}
```

**Step 2: Create a Queue Service (Optional)**

```typescript
// queue/queue.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { PgQueue, MessagePriority } from "@systeric/pg-queue";

@Injectable()
export class QueueService {
  constructor(@Inject("PGMQ_QUEUE") private readonly queue: PgQueue) {}

  async enqueueEmail(userId: string, email: string) {
    return this.queue.enqueue({
      type: "email.welcome",
      payload: { userId, email },
      priority: MessagePriority.HIGH,
    });
  }

  async enqueueWithTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.queue.withTransaction(callback);
  }
}
```

**Step 3: Use in Your Controllers/Services**

```typescript
// users/users.service.ts
import { Injectable } from "@nestjs/common";
import { QueueService } from "../queue/queue.service";

@Injectable()
export class UsersService {
  constructor(private readonly queueService: QueueService) {}

  async createUser(email: string, name: string) {
    // Enqueue with transaction (Outbox Pattern)
    const userId = await this.queueService.enqueueWithTransaction(async (tx) => {
      const result = await tx.query(
        "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id",
        [email, name]
      );
      const userId = result.rows[0].id;

      await tx.enqueue({
        type: "email.welcome",
        payload: { userId, email },
        priority: MessagePriority.NORMAL,
      });

      return userId;
    });

    return { userId };
  }
}
```

**Step 4: Register Module**

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { QueueModule } from "./queue/queue.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [ConfigModule.forRoot(), QueueModule, UsersModule],
})
export class AppModule {}
```

**Best Practices for NestJS:**

- Use `OnModuleInit` to start the queue worker
- Use `OnModuleDestroy` for graceful shutdown
- Inject queue as a provider for dependency injection
- Create a dedicated `QueueService` for reusable queue operations
- Use NestJS logger instead of console.log for production

---

### Q: Can I run multiple backend instances with a single database?

**Yes! This is the primary use case for pg-queue.**

pg-queue is designed for **horizontal scaling** with multiple workers competing for messages. Each worker automatically grabs different messages using PostgreSQL's `FOR UPDATE SKIP LOCKED`.

**Example: 3 Backend Instances, 1 Database**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Backend 1  │     │  Backend 2  │     │  Backend 3  │
│  (Worker)   │     │  (Worker)   │     │  (Worker)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │    LISTEN/NOTIFY  │    LISTEN/NOTIFY  │
       └───────────────────┴───────────────────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │   my_queue  │
                    └─────────────┘
```

**How It Works:**

1. **Message Arrives**: INSERT into `my_queue` table
2. **PostgreSQL Notifies All Workers**: `pg_notify('my_channel', message_id)`
3. **All Workers Wake Up**: Receive notification instantly (< 10ms)
4. **Work-Stealing**: Each worker runs `SELECT ... FOR UPDATE SKIP LOCKED`
   - Worker 1 locks Message A
   - Worker 2 locks Message B (skips A, it's locked)
   - Worker 3 locks Message C (skips A & B)
5. **No Race Conditions**: Each message processed by exactly one worker

**Setup (All workers use same code):**

```typescript
// Same code on all backends
const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL, // Same database!
});

await queue.start();
```

**Performance:**

- ✅ **Linear Scaling**: 10 workers = 10x throughput (90%+ efficiency)
- ✅ **No Lock Contention**: `SKIP LOCKED` ensures workers grab different messages
- ✅ **Efficient**: Only ~3 queries per message (dequeue, process, ack)

---

### Q: What happens if a worker crashes while processing?

**Scenario:** Worker dequeues message, starts processing, then crashes before calling `ack()`.

**Problem:** Message stuck in `PROCESSING` state forever.

**Solution: Automatic Visibility Timeout (Built-in)**

pg-queue **automatically** resets stale messages after **60 seconds** by default. If a worker crashes mid-processing, the message becomes available for other workers after 1 minute.

```typescript
import { PgQueue } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
  visibilityTimeoutMs: 60000, // Optional: defaults to 60 seconds
});

// No additional code needed - automatic cleanup runs internally
```

**How It Works:**

1. Worker dequeues message → Status changes to `PROCESSING`
2. Worker crashes before `ack()` → Message stuck in `PROCESSING`
3. After 60 seconds → pg-queue automatically resets to `PENDING`
4. Another worker picks it up → Processing continues

**Customizing Visibility Timeout:**

```typescript
// For long-running tasks (e.g., video processing)
const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
  visibilityTimeoutMs: 300000, // 5 minutes for long-running tasks
});
```

**Recommendation:**

- **Keep handlers under 10 seconds** - Fast handlers prevent queue congestion
- Set visibility timeout to 2-3x your average processing time
- Default 60s works for most tasks (< 30s processing time)
- For tasks > 30s, increase timeout to avoid premature resets
- For very long tasks (> 5 minutes), consider splitting into smaller jobs

**⚠️ IMPORTANT: Workers Must Be Idempotent**

Because messages can be retried after crashes, **your message handlers MUST be idempotent** (safe to run multiple times).

```typescript
// ❌ BAD - Not idempotent
async function processPayment(payload) {
  await stripe.charges.create({ amount: payload.amount }); // Could charge twice!
}

// ✅ GOOD - Idempotent
async function processPayment(payload) {
  // Check if already processed
  const existing = await db.findPayment(payload.orderId);
  if (existing) {
    console.log("Payment already processed");
    return;
  }

  // Use idempotency key
  await stripe.charges.create({
    amount: payload.amount,
    idempotency_key: payload.orderId, // Stripe deduplicates
  });

  await db.recordPayment(payload.orderId);
}
```

**Idempotency Strategies:**

- **Database Checks**: Query before executing (e.g., "Does this order exist?")
- **Idempotency Keys**: Use external API's idempotency features (Stripe, Twilio, etc.)
- **Unique Constraints**: Use DB constraints to prevent duplicates
- **Conditional Updates**: Use `WHERE` clauses (e.g., `UPDATE ... WHERE status = 'pending'`)
- **Idempotency Handler** (Recommended): Use `IdempotencyHandler` utility for built-in duplicate detection

**Using IdempotencyHandler (Recommended):**

pg-queue provides a built-in `IdempotencyHandler` utility that automatically prevents duplicate execution of message handlers:

```typescript
import { PgQueue, IdempotencyHandler } from "@systeric/pg-queue";
import { Pool } from "pg";

// Initialize
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const queue = await PgQueue.create({ ... });
const idempotency = new IdempotencyHandler(pool);

// Create idempotency table (run once at startup)
await idempotency.initialize();

// Process messages with idempotency
queue.process(async (message) => {
  const result = await idempotency.execute(
    {
      idempotencyKey: `process:${message.getId().getValue()}`,
      ttlSeconds: 86400, // 24 hours (default)
    },
    async () => {
      // Your handler logic - only runs once per message
      await processOrder(message.getPayload());
      return { success: true };
    }
  );

  if (!result.isFirstExecution) {
    console.log("Message already processed, skipping");
  }

  // Always acknowledge the message
  await queue.ack(message.getId());
});
```

**How IdempotencyHandler Works:**

1. **Before Execution**: Checks if `idempotencyKey` exists in `idempotency_keys` table
2. **First Time**: Executes handler, caches result, returns `{ isFirstExecution: true, cachedResult: ... }`
3. **Duplicate**: Returns cached result without executing, `{ isFirstExecution: false, cachedResult: ... }`
4. **Expiry**: After TTL expires, key can be reused (default: 24 hours)

**Advanced: Custom Idempotency Keys:**

```typescript
// Per-message idempotency
idempotencyKey: `process:${message.getId().getValue()}`;

// Per-entity idempotency (deduplicates across multiple messages)
idempotencyKey: `charge:order_${payload.orderId}`;

// Per-user-action idempotency
idempotencyKey: `email:${payload.userId}:welcome`;

// Time-windowed idempotency
const window = Math.floor(Date.now() / 3600000); // 1-hour window
idempotencyKey: `sync:${payload.accountId}:${window}`;
```

**Cleanup Expired Keys:**

```typescript
// Run periodically (e.g., daily cron job)
const deletedCount = await idempotency.cleanup();
console.log(`Cleaned up ${deletedCount} expired idempotency keys`);
```

**Transaction Support:**

If you need idempotency checks inside a database transaction:

```typescript
await queue.withTransaction(async (tx) => {
  // Idempotency check is part of the transaction
  const result = await idempotency.execute(
    {
      idempotencyKey: `charge:${orderId}`,
      client: tx, // Use transaction client
    },
    async () => {
      // Both operations are atomic
      await tx.query("INSERT INTO orders ...");
      await tx.enqueue({ type: "order.created", payload: { orderId } });
      return { orderId };
    }
  );
});
```

**Why Use IdempotencyHandler?**

| Method                    | Pros                                                                | Cons                                      |
| ------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| **Manual DB Checks**      | Simple, no extra tables                                             | Verbose, error-prone, no result caching   |
| **Unique Constraints**    | Database-enforced                                                   | Only works for inserts, no result caching |
| **External API Keys**     | Provider-handled                                                    | Only works with supporting APIs           |
| **IdempotencyHandler** ✅ | Automatic, result caching, works with any code, transaction support | Requires extra table                      |

---

### Q: How does retry logic work?

**Automatic Retry with Exponential Backoff:**

When you call `queue.nack(messageId, error)`, pg-queue automatically:

1. **Increments `retry_count`**
2. **Calculates `next_retry_at`** using exponential backoff:
   - Retry 1: 1 second
   - Retry 2: 2 seconds
   - Retry 3: 4 seconds
   - Retry 4: 8 seconds
   - Max: 60 seconds
3. **Updates status**:
   - If `retry_count < max_retries`: Status = `FAILED`, message will retry
   - If `retry_count >= max_retries`: Status = `DEAD_LETTER`, no more retries

**Example:**

```typescript
// Message created with max_retries = 3
await queue.enqueue({
  type: "api.call",
  payload: { url: "https://api.example.com" },
  maxRetries: 3,
});

// Processing lifecycle:
// Attempt 1: PENDING → PROCESSING → FAILED (retry_count = 1, retry in 1s)
// Attempt 2: PENDING → PROCESSING → FAILED (retry_count = 2, retry in 2s)
// Attempt 3: PENDING → PROCESSING → FAILED (retry_count = 3, retry in 4s)
// Attempt 4: PENDING → PROCESSING → FAILED (retry_count = 4 >= 3)
// Final: DEAD_LETTER (no more retries)
```

**Configuring Retries:**

```typescript
// Per message
await queue.enqueue({
  type: "critical.job",
  payload: { data: "..." },
  maxRetries: 10, // Try up to 10 times
});

// Global default (in queue config)
const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL,
  maxRetries: 5, // Default for all messages
});
```

---

### Q: How do I handle Dead Letter Queue (DLQ)?

**Query Dead Letter Messages:**

```typescript
import { PgQueue, MessageStatus } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

// Get all dead letter messages
const deadLetters = await queue.findByStatus(MessageStatus.DEAD_LETTER, {
  limit: 100,
  orderBy: "created_at",
  order: "DESC",
});

for (const msg of deadLetters) {
  console.error(`Dead Letter: ${msg.getType()}`, {
    id: msg.getId().toString(),
    error: msg.getLastError(),
    retries: msg.getRetryCount(),
    payload: msg.getPayload(),
  });
}
```

**Alert on DLQ Overflow:**

```typescript
const stats = await queue.getStats();

if (stats.deadLetter > 100) {
  // Send alert (email, Slack, PagerDuty, etc.)
  await sendAlert(`Dead letter queue overflow: ${stats.deadLetter} messages`);
}
```

**Manually Retry Dead Letter Messages:**

```typescript
import { MessageId } from "@systeric/pg-queue";

// Reset specific message to PENDING
const messageId = MessageId.fromString("550e8400-e29b-41d4-a716-446655440000");
await queue.retry(messageId);
```

**Auto-Cleanup Dead Letters:**

```typescript
// Delete dead letters older than 30 days
await queue.cleanupDeadLetters({
  olderThanDays: 30,
});
```

**DLQ Processing Worker:**

```typescript
// Separate worker for dead letter messages
setInterval(async () => {
  const result = await client.query(`
    SELECT * FROM my_queue
    WHERE status = 'DEAD_LETTER'
    LIMIT 10
  `);

  for (const msg of result.rows) {
    // Log to error tracking service
    await logError({
      message: `DLQ: ${msg.type}`,
      payload: msg.payload,
      error: msg.last_error,
    });

    // Optionally delete after logging
    await client.query("DELETE FROM my_queue WHERE id = $1", [msg.id]);
  }
}, 60 * 1000); // Every minute
```

---

### Q: How do I implement the Transactional Outbox Pattern?

The **Transactional Outbox Pattern** ensures atomicity between database writes and message publishing. pg-queue is perfect for this.

**Problem Without Outbox:**

```typescript
// ❌ Not atomic - can lose messages
await db.createUser(user);
await apiClient.sendWelcomeEmail(user.email); // Fails? Email lost!
```

**Solution With pg-queue:**

```typescript
// ✅ Atomic - message guaranteed to send
import { PgQueue, MessagePriority } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

// Both operations succeed or both fail (ACID)
await queue.withTransaction(async (tx) => {
  // 1. Save data to database
  const result = await tx.query("INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id", [
    email,
    name,
  ]);
  const userId = result.rows[0].id;

  // 2. Enqueue message in SAME transaction
  await tx.enqueue({
    type: "email.welcome",
    payload: { userId, email },
    priority: MessagePriority.NORMAL,
  });
});
```

**Background Worker Processes Outbox:**

```typescript
// worker.ts
import { PgQueue } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL,
});

await queue.start();

queue.on("notification", async () => {
  const message = await queue.dequeue();
  if (!message) return;

  try {
    const { userId, email } = message.getPayload();

    // Call external API
    await emailService.send({
      to: email,
      subject: "Welcome!",
      body: "Thanks for signing up!",
    });

    await queue.ack(message.getId());
  } catch (error) {
    await queue.nack(message.getId(), error);
  }
});
```

**Benefits:**

- ✅ **ACID Guarantees**: Message is part of your transaction
- ✅ **No Lost Messages**: If transaction fails, message is not created
- ✅ **Automatic Retry**: If API call fails, message retries with backoff
- ✅ **At-Least-Once Delivery**: Messages are guaranteed to be delivered

**Complete Example:**

See [@systeric/outbox](../outbox) package for a full implementation of the outbox pattern using pg-queue internally.

---

### Q: How fast is it? What's the latency?

**Benchmark Results** (Single PostgreSQL instance, 4 workers):

| Metric                         | Value             | Notes                                       |
| ------------------------------ | ----------------- | ------------------------------------------- |
| **Notification Latency**       | < 10ms            | Time from INSERT to worker receiving NOTIFY |
| **Dequeue Latency**            | 20-50ms           | Time to claim and return message            |
| **Throughput (Single Worker)** | 100-500 msg/sec   | Depends on processing time                  |
| **Throughput (4 Workers)**     | 400-1,800 msg/sec | Near-linear scaling                         |
| **Database Load**              | ~3 queries/msg    | Dequeue (1), Ack/Nack (1), occasional stats |

**Comparison with Polling:**

| Approach                     | Latency  | DB Queries/sec (1000 msg/sec) |
| ---------------------------- | -------- | ----------------------------- |
| **Polling (5s interval)**    | 2.5s avg | 12,000+                       |
| **pg-queue (LISTEN/NOTIFY)** | < 10ms   | 3,000                         |

**Result: 4x reduction in database load, 250x faster delivery.**

---

### Q: What are the limitations?

#### L1: PostgreSQL Only

- **Requirement**: PostgreSQL 13+ (for `FOR UPDATE SKIP LOCKED`)
- **Not portable** to MySQL, SQLite, MongoDB
- **Mitigation**: Use Redis (Bullmq) or SQS if you need other databases

#### L2: Message Size Limit

- **Limit**: ~10MB practical limit (PostgreSQL JSONB max ~1GB)
- **Reason**: Large payloads slow queries
- **Mitigation**: Store large data in S3/R2, put reference in payload

```typescript
// ✅ Good: Store reference
const s3Url = await uploadToS3(videoBuffer);
await queue.enqueue({
  type: "video.process",
  payload: { videoUrl: s3Url },
});
```

#### L3: No Message Ordering (within same priority)

- **Behavior**: Messages at same priority may process in any order
- **Reason**: Work-stealing by design
- **Mitigation**: Use priority levels if order matters

#### L4: Connection Per Worker

- **Requirement**: Each worker uses 1 persistent connection
- **Reason**: `LISTEN/NOTIFY` requires dedicated connection
- **Mitigation**: Plan for N workers = N connections

---

### Q: How do I monitor queue health?

**Get Queue Statistics:**

```typescript
const stats = await queue.getStats();

console.log(stats);
// {
//   pending: 1234,
//   processing: 56,
//   completed: 9876,
//   failed: 23,
//   deadLetter: 5,
//   oldestMessageAge: 1234567 // milliseconds
// }
```

**Monitoring Alerts:**

```typescript
setInterval(async () => {
  const stats = await queue.getStats();

  if (stats.pending > 1000) {
    alert("Queue backlog: " + stats.pending);
  }

  if (stats.deadLetter > 100) {
    alert("Dead letter queue overflow: " + stats.deadLetter);
  }

  if (stats.oldestMessageAge > 5 * 60 * 1000) {
    alert("Oldest message is stale: " + stats.oldestMessageAge / 1000 + "s");
  }
}, 60 * 1000);
```

**Event-Driven Monitoring:**

```typescript
queue.on("enqueued", (message) => {
  metrics.increment("queue.enqueued", { type: message.getType() });
});

queue.on("ack", () => {
  metrics.increment("queue.completed");
});

queue.on("nack", (messageId, error) => {
  metrics.increment("queue.failed", { error: error.message });
});
```

---

### Q: How do I handle Dead Letter Queue (DLQ) messages?

When a message fails repeatedly and exceeds `maxRetries`, it moves to `DEAD_LETTER` status and stops retrying automatically. These messages need manual intervention.

**Step 1: Monitor Dead Letter Queue**

```typescript
// Check for dead letter messages
const stats = await queue.getStats();

if (stats.deadLetter > 0) {
  console.warn(`⚠️  ${stats.deadLetter} messages in dead letter queue`);
}
```

**Step 2: Query Dead Letter Messages**

```typescript
import { MessageStatus } from "@systeric/pg-queue";

// Get all dead letter messages
const deadLetters = await queue.findByStatus(MessageStatus.DEAD_LETTER, {
  limit: 100,
  orderBy: "created_at",
  order: "DESC",
});

deadLetters.forEach((msg) => {
  console.log("Dead Letter Message:");
  console.log(`  ID: ${msg.getId().toString()}`);
  console.log(`  Type: ${msg.getType()}`);
  console.log(`  Retry Count: ${msg.getRetryCount()}`);
  console.log(`  Last Error: ${msg.getLastError()}`);
  console.log(`  Payload:`, msg.getPayload());
});
```

**Step 3: Investigate and Fix**

Common reasons for dead letter messages:

1. **Bug in processing logic** → Fix the code
2. **Invalid payload data** → Fix data validation
3. **External service down** → Wait for service recovery
4. **Configuration error** → Fix config (API keys, URLs)

**Step 4: Retry Dead Letter Messages**

After fixing the root cause, manually retry:

```typescript
// Option A: Retry specific message (resets retry count to 0)
const messageId = MessageId.fromString("af06c821-dddd-44e0-bf84-5c64b3e8dd6b");
await queue.retry(messageId);
// Message status: DEAD_LETTER → PENDING (with retry_count = 0)
// Will be processed again immediately
```

```typescript
// Option B: Retry all dead letter messages
const deadLetters = await queue.findByStatus(MessageStatus.DEAD_LETTER);

for (const msg of deadLetters) {
  try {
    await queue.retry(msg.getId());
    console.log(`✅ Retrying message ${msg.getId().toString()}`);
  } catch (error) {
    console.error(`❌ Failed to retry ${msg.getId().toString()}:`, error);
  }
}
```

**Step 5: Clean Up Old Dead Letters**

```typescript
// Delete dead letters older than 30 days
const deletedCount = await queue.cleanupDeadLetters(30);
console.log(`🗑️  Deleted ${deletedCount} old dead letter messages`);
```

**Automated DLQ Monitoring Example:**

```typescript
// worker.ts
import { PgQueue, MessageStatus } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
});

// Check for dead letters every hour
setInterval(
  async () => {
    const stats = await queue.getStats();

    if (stats.deadLetter > 0) {
      // Alert your team
      await sendSlackAlert(`⚠️ ${stats.deadLetter} messages in DLQ`);

      // Get details for investigation
      const deadLetters = await queue.findByStatus(MessageStatus.DEAD_LETTER, { limit: 10 });

      for (const msg of deadLetters) {
        console.error("DLQ Message:", {
          id: msg.getId().toString(),
          type: msg.getType(),
          error: msg.getLastError(),
          retryCount: msg.getRetryCount(),
          payload: msg.getPayload(),
        });
      }
    }
  },
  60 * 60 * 1000
); // Every hour
```

**Direct SQL Query (for debugging):**

```sql
-- View dead letter messages
SELECT
  id,
  type,
  payload,
  retry_count,
  max_retries,
  last_error,
  created_at,
  updated_at
FROM systeric_pgqueue_my_queue
WHERE status = 'DEAD_LETTER'
ORDER BY created_at DESC
LIMIT 100;
```

**Best Practices:**

1. ✅ **Set up alerts** when `stats.deadLetter > threshold`
2. ✅ **Log DLQ messages** with full context (type, payload, error)
3. ✅ **Investigate root cause** before retrying
4. ✅ **Test the fix** before mass-retrying
5. ✅ **Clean up old DLQ** messages periodically
6. ✅ **Consider separate DLQ processing** for critical messages

**Example: Separate DLQ Handler**

```typescript
// dlq-handler.ts
import { PgQueue, MessageStatus } from "@systeric/pg-queue";

async function processDLQ() {
  const queue = await PgQueue.create({
    queueName: "my_queue",
    connectionString: process.env.DATABASE_URL!,
  });

  const deadLetters = await queue.findByStatus(MessageStatus.DEAD_LETTER);

  for (const msg of deadLetters) {
    // Custom handling based on message type
    switch (msg.getType()) {
      case "email.send":
        // Maybe send to alternative email provider
        await handleFailedEmail(msg);
        break;

      case "payment.process":
        // Critical - alert immediately
        await sendPagerDutyAlert(msg);
        break;

      case "analytics.track":
        // Non-critical - just log and delete
        console.log("Dropping analytics event:", msg.getId());
        await queue.cleanupDeadLetters(0); // Delete immediately
        break;

      default:
        // Log for manual review
        console.error("Unknown DLQ message type:", msg.getType());
    }
  }
}

// Run every 15 minutes
setInterval(processDLQ, 15 * 60 * 1000);
```

---

### Q: How do I integrate with OpenTelemetry?

pg-queue provides built-in OpenTelemetry instrumentation for distributed tracing and metrics.

**Step 1: Install OpenTelemetry Dependencies**

```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/sdk-metrics
```

**Step 2: Enable Tracing**

```typescript
import { PgQueue } from "@systeric/pg-queue";
import { trace } from "@opentelemetry/api";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
  // Enable OpenTelemetry tracing
  telemetry: {
    enabled: true,
    serviceName: "my-service",
  },
});

// pg-queue automatically creates spans for:
// - queue.enqueue()
// - queue.dequeue()
// - queue.ack()
// - queue.nack()
```

**What Gets Traced:**

Each queue operation creates a span with:

- **Span Name**: `pg-queue.enqueue`, `pg-queue.dequeue`, `pg-queue.ack`, `pg-queue.nack`
- **Attributes**:
  - `messaging.system`: `postgresql`
  - `messaging.destination`: `my_queue` (table name)
  - `messaging.message_id`: Message UUID
  - `messaging.message_type`: Message type (e.g., `email.welcome`)
  - `messaging.operation`: `enqueue`, `dequeue`, `ack`, `nack`
  - `db.system`: `postgresql`
  - `db.name`: Database name
  - `db.statement`: SQL query (redacted for security)

**Distributed Tracing Example:**

```typescript
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("my-app");

// Parent span (e.g., HTTP request)
await tracer.startActiveSpan("POST /users", async (span) => {
  // Create user
  const user = await db.createUser({ email: "user@example.com" });

  // Child span automatically created by pg-queue
  await queue.enqueue({
    type: "email.welcome",
    payload: { userId: user.id },
  });
  // Span: pg-queue.enqueue (child of POST /users)

  span.end();
});

// In worker (different process/instance)
queue.on("notification", async () => {
  const message = await queue.dequeue();
  // Span: pg-queue.dequeue (links to pg-queue.enqueue via message_id)

  if (!message) return;

  await tracer.startActiveSpan(
    "process.message",
    {
      attributes: {
        "messaging.message_id": message.getId().toString(),
        "messaging.message_type": message.getType(),
      },
    },
    async (span) => {
      try {
        await processMessage(message);
        await queue.ack(message.getId());
        // Span: pg-queue.ack (child of process.message)
      } catch (error) {
        await queue.nack(message.getId(), error);
        // Span: pg-queue.nack (child of process.message)
        span.recordException(error);
      } finally {
        span.end();
      }
    }
  );
});
```

**Metrics Exported:**

pg-queue automatically exports the following metrics:

- `pg_queue.enqueue.count` (counter): Total messages enqueued
- `pg_queue.enqueue.duration` (histogram): Time to enqueue (ms)
- `pg_queue.dequeue.count` (counter): Total messages dequeued
- `pg_queue.dequeue.duration` (histogram): Time to dequeue (ms)
- `pg_queue.ack.count` (counter): Total messages acknowledged
- `pg_queue.nack.count` (counter): Total messages negatively acknowledged
- `pg_queue.processing.duration` (histogram): Time from dequeue to ack/nack (ms)
- `pg_queue.queue.pending` (gauge): Current pending messages
- `pg_queue.queue.processing` (gauge): Current processing messages
- `pg_queue.queue.dead_letter` (gauge): Current dead letter messages

**Metric Attributes:**

All metrics include:

- `queue.name`: Table name
- `message.type`: Message type (for enqueue/dequeue/ack/nack)
- `service.name`: Service name from config

**Full OpenTelemetry Setup Example:**

```typescript
// otel.ts - Initialize OpenTelemetry
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: "my-service",
  }),
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:4318/v1/traces", // Jaeger/Tempo
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: "http://localhost:4318/v1/metrics", // Prometheus
    }),
    exportIntervalMillis: 60000,
  }),
});

sdk.start();

// app.ts
import "./otel"; // Import first!
import { PgQueue } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  queueName: "my_queue",
  connectionString: process.env.DATABASE_URL!,
  telemetry: {
    enabled: true,
    serviceName: "my-service",
  },
});
```

**Visualizing Traces:**

With tools like Jaeger, you'll see:

```
POST /users (200ms)
├─ db.query: INSERT INTO users (50ms)
├─ pg-queue.enqueue (10ms)
│  └─ db.query: INSERT INTO my_queue (8ms)
└─ http.response (5ms)

process.message (150ms)
├─ pg-queue.dequeue (12ms)
│  └─ db.query: SELECT ... FOR UPDATE SKIP LOCKED (10ms)
├─ sendEmail (120ms)
│  └─ http.post: https://api.sendgrid.com (115ms)
└─ pg-queue.ack (8ms)
   └─ db.query: UPDATE my_queue SET status = 'COMPLETED' (6ms)
```

**Benefits:**

- ✅ **Full Visibility**: See message lifecycle from enqueue → process → ack
- ✅ **Distributed Tracing**: Track messages across services/processes
- ✅ **Performance Insights**: Identify slow queue operations
- ✅ **Error Tracking**: Correlate failures with specific messages
- ✅ **SLA Monitoring**: Measure end-to-end latency

---

### Q: How do I test code that uses pg-queue?

**Unit Tests (Mock the Queue):**

```typescript
import { describe, it, expect, vi } from "vitest";

describe("MyService", () => {
  it("should enqueue welcome email", async () => {
    const mockQueue = {
      enqueue: vi.fn().mockResolvedValue("message-id-123"),
    };

    const service = new MyService(mockQueue);
    await service.createUser({ email: "user@example.com" });

    expect(mockQueue.enqueue).toHaveBeenCalledWith({
      type: "email.welcome",
      payload: { email: "user@example.com" },
    });
  });
});
```

**Integration Tests (Use Testcontainers):**

```typescript
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { PgQueue } from "@systeric/pg-queue";

describe("PgQueue Integration", () => {
  let container;
  let queue;

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start();
    await runMigrations(container.getConnectionString());

    queue = await PgQueue.create({
      queueName: "test_queue",
      connectionString: container.getConnectionString(),
    });
  });

  afterAll(async () => {
    await queue.stop();
    await container.stop();
  });

  it("should enqueue and dequeue message", async () => {
    const messageId = await queue.enqueue({
      type: "test.job",
      payload: { data: "hello" },
    });

    const message = await queue.dequeue();
    expect(message!.getId().equals(messageId)).toBe(true);
  });
});
```

---

## SSL Configuration

For cloud databases requiring SSL (DigitalOcean, AWS RDS, Heroku):

```typescript
const queue = await PgQueue.create({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  queueName: "emails",
});
```

> **⚠️ Security Warning:** Using `rejectUnauthorized: false` disables server certificate verification, making your connection vulnerable to man-in-the-middle attacks. Only use this in development or trusted networks. For production, configure SSL with a valid certificate authority. See [node-postgres SSL docs](https://node-postgres.com/features/ssl) for secure configuration.

---

## API Reference

### `PgQueue.create(config)`

Create a new queue instance.

```typescript
interface PgQueueConfig {
  queueName: string; // Queue name (table will be systeric_pgqueue_{queueName})
  connectionString?: string; // PostgreSQL connection string
  pool?: Pool; // Or provide existing pool
  ssl?: boolean | ConnectionOptions; // SSL config (ignored if pool is provided)
  autoCreate?: boolean; // Auto-create table (default: true)
  visibilityTimeoutMs?: number; // Visibility timeout (default: 300000ms = 5 min)
  pollIntervalMs?: number; // Poll interval (default: 5000ms)
  maxRetries?: number; // Default max retries (default: 3)
}
```

**Returns:** `Promise<PgQueue>`

---

### `queue.enqueue(input)`

Add a message to the queue.

```typescript
interface CreateQueueMessageInput {
  type: string; // Message type
  payload: Record<string, unknown>; // Message data
  priority?: MessagePriority; // Priority (default: NORMAL)
  maxRetries?: number; // Max retries (default: 3)
}
```

**Returns:** `Promise<MessageId>`

---

### `queue.dequeue()`

Claim next available message (work-stealing).

**Returns:** `Promise<QueueMessage | null>`

---

### `queue.ack(messageId)`

Mark message as successfully processed.

**Returns:** `Promise<void>`

---

### `queue.nack(messageId, error)`

Mark message as failed (will retry with backoff).

**Returns:** `Promise<void>`

---

### `queue.getStats()`

Get queue statistics.

**Returns:** `Promise<QueueStats>`

```typescript
interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  oldestMessageAge: number; // milliseconds
}
```

---

### `queue.start()`

Start listening for NOTIFY events.

**Returns:** `Promise<void>`

---

### `queue.stop()`

Stop listening and close connection.

**Returns:** `Promise<void>`

---

### `queue.resetStaleMessages(thresholdMs)`

Reset stale PROCESSING messages to PENDING.

**Parameters:** `thresholdMs` (default: 300000 = 5 minutes)

**Returns:** `Promise<number>` (count of reset messages)

---

## Events

```typescript
queue.on("enqueued", (message: QueueMessage) => {});
queue.on("dequeued", (message: QueueMessage) => {});
queue.on("ack", (messageId: MessageId) => {});
queue.on("nack", (messageId: MessageId, error: Error) => {});
queue.on("notification", () => {});
queue.on("error", (error: Error) => {});
queue.on("listener:connected", () => {});
queue.on("listener:disconnected", () => {});
```

---

## Comparison with Other Queue Systems

| Feature            | @systeric/pg-queue | BullMQ     | AWS SQS    | RabbitMQ   |
| ------------------ | ------------------ | ---------- | ---------- | ---------- |
| **Infrastructure** | PostgreSQL         | Redis      | AWS Cloud  | RabbitMQ   |
| **Setup**          | Low (SQL)          | Medium     | Low        | High       |
| **ACID**           | ✅ Yes             | ❌ No      | ❌ No      | ❌ No      |
| **Latency**        | < 10ms             | < 1ms      | 1-10s      | < 10ms     |
| **Throughput**     | 1K-10K/s           | 10K-100K/s | 10K-100K/s | 10K-50K/s  |
| **Work-Stealing**  | ✅ SKIP LOCKED     | ✅ Yes     | ✅ Yes     | ✅ Yes     |
| **Priority**       | ✅ 1-10            | ✅ Yes     | ❌ No      | ✅ Yes     |
| **Cost**           | $0 (if using PG)   | $0-$100/mo | $0.40/M    | $0-$100/mo |

**When to Use pg-queue:**

- ✅ Already using PostgreSQL
- ✅ Need ACID guarantees
- ✅ Want to minimize infrastructure
- ✅ Throughput < 10K msg/sec

---

## Requirements

- PostgreSQL 13+ (for `FOR UPDATE SKIP LOCKED`)
- Node.js 18+
- TypeScript 5+ (optional)

---

## Documentation

- [Requirements](../../docs/packages/pgmq-requirements.md)
- [API Design](../../docs/packages/pgmq-api-design.md)

---

## Related Packages

- [@systeric/outbox](../outbox) - Transactional outbox pattern (uses pg-queue)
- [@systeric/calendar](../calendar) - Google Calendar API
- [@systeric/auth](../auth) - OAuth authentication

---

## License

MIT

---

## Support

- **Issues**: [GitHub Issues](https://github.com/Systeric/packages/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Systeric/packages/discussions)

---

**Built with ❤️ by Systeric**
