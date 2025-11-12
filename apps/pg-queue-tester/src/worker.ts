import { PgQueue } from "@systeric/pg-queue";

const connectionString =
  process.env["DATABASE_URL"] || "postgresql://postgres:postgres@localhost:5432/pg_queue_test";

console.log("🔧 Starting pg-queue worker...");

async function startWorker() {
  // Create queue instance
  const queue = await PgQueue.create({
    queueName: "test_queue",
    connectionString,
    autoCreate: true,
    visibilityTimeoutMs: 60000, // 60 seconds
    pollIntervalMs: 5000, // 5 seconds fallback polling
  });

  console.log("✅ Worker initialized");
  console.log(`   Table: ${queue.getTableName()}`);
  console.log(`   Channel: ${queue.getChannelName()}`);
  console.log("👂 Listening for messages...\n");

  // Event handlers for monitoring
  queue.on("enqueued", (message: any) => {
    console.log(`📥 Message enqueued: ${message.getId().toString()}`);
  });

  queue.on("dequeued", (message: any) => {
    console.log(`🎯 Message dequeued: ${message.getId().toString()}`);
  });

  queue.on("ack", (messageId: any) => {
    console.log(`✅ Message acknowledged: ${messageId.toString()}`);
  });

  queue.on("nack", (messageId: any, error: any) => {
    console.log(`❌ Message failed: ${messageId.toString()}`);
    console.log(`   Error: ${error.message}`);
  });

  queue.on("error", (error: any) => {
    console.error("❗ Queue error:", error);
  });

  queue.on("stale:reset", (count: number) => {
    console.log(`🔄 Reset ${count} stale messages`);
  });

  queue.on("retry:reset", (count: number) => {
    console.log(`♻️  Reset ${count} failed messages for retry`);
    // Trigger processing when retries are reset
    void processNextMessage();
  });

  // Start listening for NOTIFY events
  await queue.start();

  // Shared message processing function
  async function processNextMessage() {
    try {
      // Try to dequeue a message
      const message = await queue.dequeue();

      if (!message) {
        // No message available
        return;
      }

      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🚀 Processing message:");
      console.log(`   ID: ${message.getId().toString()}`);
      console.log(`   Type: ${message.getType()}`);
      console.log(`   Priority: ${message.getPriority().getValue()}`);
      console.log(`   Retry: ${message.getRetryCount()}/${message.getMaxRetries()}`);
      console.log(`   Payload:`, message.getPayload());
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      try {
        // Simulate message processing based on type
        await processMessage(message.getType(), message.getPayload());

        // Acknowledge successful processing
        await queue.ack(message.getId());
        console.log(`✅ Message processed successfully\n`);
      } catch (error) {
        // Negative acknowledge - will retry with exponential backoff
        await queue.nack(message.getId(), error as Error);
        console.log(`❌ Message processing failed - will retry\n`);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  // Process messages when notifications arrive
  queue.on("notification", async () => {
    console.log("🔔 Notification received - new message available");
    await processNextMessage();
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("\n🛑 Shutting down worker...");
    await queue.stop();
    console.log("✅ Worker stopped gracefully");
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down worker...");
    await queue.stop();
    console.log("✅ Worker stopped gracefully");
    process.exit(0);
  });

  // Show stats every 30 seconds
  setInterval(async () => {
    const stats = await queue.getStats();
    console.log("\n📊 Queue Statistics:");
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Processing: ${stats.processing}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Failed: ${stats.failed}`);
    console.log(`   Dead Letter: ${stats.deadLetter}`);
    if (stats.oldestMessageAge) {
      console.log(`   Oldest message: ${Math.floor(stats.oldestMessageAge / 1000)}s ago`);
    }
    console.log("");
  }, 30000);
}

/**
 * Message processing logic
 * Simulates different types of work with success/failure scenarios
 */
async function processMessage(type: string, payload: any): Promise<void> {
  switch (type) {
    case "email.send":
      console.log(`   📧 Sending email to ${payload.to}...`);
      await sleep(1000); // Simulate email sending
      if (payload.to.includes("fail")) {
        throw new Error("Email delivery failed - invalid recipient");
      }
      console.log(`   ✅ Email sent successfully`);
      break;

    case "sms.send":
      console.log(`   📱 Sending SMS to ${payload.phone}...`);
      await sleep(500);
      if (payload.phone.includes("invalid")) {
        throw new Error("SMS delivery failed - invalid phone number");
      }
      console.log(`   ✅ SMS sent successfully`);
      break;

    case "webhook.post":
      console.log(`   🌐 Posting webhook to ${payload.url}...`);
      await sleep(1500);
      if (payload.url.includes("fail")) {
        throw new Error("Webhook failed - endpoint unreachable");
      }
      console.log(`   ✅ Webhook posted successfully`);
      break;

    case "task.process":
      console.log(`   ⚙️  Processing task: ${payload.taskName}...`);
      await sleep(2000);
      if (payload.shouldFail) {
        throw new Error(`Task processing failed: ${payload.failReason || "Unknown error"}`);
      }
      console.log(`   ✅ Task completed successfully`);
      break;

    default:
      console.log(`   ℹ️  Processing generic message type: ${type}`);
      await sleep(1000);
      console.log(`   ✅ Generic processing completed`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start the worker
startWorker().catch((error) => {
  console.error("❌ Failed to start worker:", error);
  process.exit(1);
});
