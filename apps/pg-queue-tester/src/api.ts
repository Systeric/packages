import { Hono } from "hono";
import { PgQueue, MessagePriority } from "@systeric/pg-queue";

const app = new Hono();

// Queue instance (shared across requests)
let queue: PgQueue | null = null;

// Initialize queue on startup
async function initQueue() {
  if (queue) return queue;

  const connectionString =
    process.env["DATABASE_URL"] || "postgresql://postgres:postgres@localhost:5432/pg_queue_test";

  queue = await PgQueue.create({
    queueName: "test_queue",
    connectionString,
    autoCreate: true, // Auto-create table if doesn't exist
  });

  console.log("✅ Queue initialized");
  console.log(`   Table: ${queue.getTableName()}`);
  console.log(`   Channel: ${queue.getChannelName()}`);

  return queue;
}

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    queue: queue ? "initialized" : "not initialized",
  });
});

// Enqueue a message
app.post("/enqueue", async (c) => {
  try {
    const q = await initQueue();
    const body = await c.req.json();

    const { type, payload, priority = 5, maxRetries = 3 } = body;

    if (!type) {
      return c.json({ error: "Missing 'type' field" }, 400);
    }

    if (!payload) {
      return c.json({ error: "Missing 'payload' field" }, 400);
    }

    const messageId = await q.enqueue({
      type,
      payload,
      priority: MessagePriority.create(priority),
      maxRetries,
    });

    return c.json({
      success: true,
      messageId: messageId.toString(),
      type,
      priority,
      maxRetries,
    });
  } catch (error) {
    console.error("Enqueue error:", error);
    return c.json(
      {
        error: "Failed to enqueue message",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// Get queue statistics
app.get("/stats", async (c) => {
  try {
    const q = await initQueue();
    const stats = await q.getStats();

    return c.json(stats);
  } catch (error) {
    console.error("Stats error:", error);
    return c.json(
      {
        error: "Failed to get stats",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// Find messages by status
app.get("/messages/:status", async (c) => {
  try {
    const q = await initQueue();
    const { status } = c.req.param();
    const limit = Number(c.req.query("limit") || "10");

    const { MessageStatus } = await import("@systeric/pg-queue");
    const messageStatus = MessageStatus.fromString(status.toUpperCase());

    const messages = await q.findByStatus(messageStatus, { limit });

    return c.json({
      status,
      count: messages.length,
      messages: messages.map((msg: any) => ({
        id: msg.getId().toString(),
        type: msg.getType(),
        payload: msg.getPayload(),
        status: msg.getStatus().toString(),
        priority: msg.getPriority().getValue(),
        retryCount: msg.getRetryCount(),
        createdAt: msg.getCreatedAt(),
      })),
    });
  } catch (error) {
    console.error("Find messages error:", error);
    return c.json(
      {
        error: "Failed to find messages",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

const port = Number(process.env["PORT"]) || 3001;

console.log(`🚀 Starting pg-queue-tester API on port ${port}...`);

// For Bun runtime
export default {
  port,
  fetch: app.fetch,
};

// For Node.js runtime (tsx, ts-node)
if (import.meta.url === `file://${process.argv[1]}`) {
  const { serve } = await import("@hono/node-server");

  serve({
    fetch: app.fetch,
    port,
  });

  console.log(`✅ Server is running on http://localhost:${port}`);
}
