# pg-queue-tester

**POC app for testing @systeric/pg-queue with Hono API and Worker**

This is a proof-of-concept application demonstrating how to use `@systeric/pg-queue` in a real-world scenario with:

- **Hono API**: HTTP endpoints for enqueuing, dequeuing, and managing messages
- **Worker Process**: Background worker that consumes messages from the queue
- **Yaak Collection**: Pre-configured HTTP requests for testing

---

## Features

### API Endpoints (Port 3001)

- `GET /health` - Health check
- `POST /enqueue` - Enqueue a new message
- `GET /stats` - Queue statistics
- `GET /messages/:status` - Query messages by status (for debugging)

**Note**: The worker automatically handles dequeue, ack, and nack operations. The API only needs to enqueue messages.

### Worker Features

- **Event-driven**: Uses LISTEN/NOTIFY for instant message delivery
- **Automatic retry**: Failed messages retry with exponential backoff
- **Multiple message types**: email.send, sms.send, webhook.post, task.process
- **Real-time monitoring**: Logs all queue events
- **Statistics**: Shows queue stats every 30 seconds
- **Graceful shutdown**: Handles SIGTERM/SIGINT

---

## Prerequisites

1. **Docker** (for running PostgreSQL)
2. **Node.js 18+**
3. **pnpm** (or npm/yarn)

---

## Setup

### 1. Start PostgreSQL

The easiest way is using Docker Compose:

```bash
cd apps/pg-queue-tester
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` with:

- **User**: postgres
- **Password**: postgres
- **Database**: pg_queue_test

To stop PostgreSQL:

```bash
docker-compose down
```

To stop and remove data:

```bash
docker-compose down -v
```

**Alternative**: If you already have PostgreSQL running, set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
```

### 2. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

### 3. The queue table will be auto-created

The app uses `autoCreate: true`, so the `systeric_pgqueue_test_queue` table will be created automatically on first run.

---

## Running the POC

### Option 1: Run Both API and Worker (Recommended)

```bash
cd apps/pg-queue-tester
pnpm dev
```

This runs both the API server and worker in parallel using `concurrently`.

### Option 2: Run Separately

**Terminal 1 - API Server:**

```bash
cd apps/pg-queue-tester
pnpm dev:api
```

**Terminal 2 - Worker:**

```bash
cd apps/pg-queue-tester
pnpm dev:worker
```

---

## Testing the API

### Option 1: Using curl commands (Recommended)

All API requests are available in `requests.sh`:

```bash
# Run all requests
./requests.sh

# Or copy individual commands from the file
```

**Quick test:**

```bash
# Health check
curl http://localhost:3001/health

# Enqueue a message
curl -X POST http://localhost:3001/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.send",
    "payload": {"to": "test@example.com", "subject": "Test", "body": "Hello"},
    "priority": 5,
    "maxRetries": 3
  }'

# Check stats
curl http://localhost:3001/stats
```

### Option 2: Using Yaak/Postman/Insomnia

1. Open Yaak (or Postman/Insomnia)
2. Click **Import**
3. Select the file: `postman-collection.json`

### Quick Test Flow

1. **Start the app**: `pnpm dev`
2. **Health Check**: Should return `{"status":"ok"}`
3. **Enqueue a message**: Use curl or the requests.sh script
4. **Watch the worker**: The worker terminal should show the message being processed
5. **Check stats**: `curl http://localhost:3001/stats`

### Available Test Scenarios

**Success Cases:**

- Email send (normal priority)
- SMS send (high priority)
- Webhook post
- Task processing

**Failure Cases (will retry):**

- Email with `fail@example.com` → triggers retry logic
- Task with `shouldFail: true` → simulates processing error

---

## Example Requests

### Enqueue a Message

```bash
curl -X POST http://localhost:3001/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email.send",
    "payload": {
      "to": "user@example.com",
      "subject": "Test",
      "body": "Hello"
    },
    "priority": 5,
    "maxRetries": 3
  }'
```

**Response:**

```json
{
  "success": true,
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "email.send",
  "priority": 5,
  "maxRetries": 3
}
```

### Get Queue Stats

```bash
curl http://localhost:3001/stats
```

**Response:**

```json
{
  "pending": 5,
  "processing": 1,
  "completed": 42,
  "failed": 2,
  "deadLetter": 0,
  "oldestMessageAge": 1234
}
```

### Query PENDING Messages

```bash
curl http://localhost:3001/messages/PENDING?limit=10
```

---

## Message Types

The worker supports 4 message types:

### 1. Email Send

```json
{
  "type": "email.send",
  "payload": {
    "to": "user@example.com",
    "subject": "Hello",
    "body": "Message content"
  }
}
```

- Success: Any email address without "fail"
- Failure: Email addresses containing "fail" will trigger retry

### 2. SMS Send

```json
{
  "type": "sms.send",
  "payload": {
    "phone": "+1234567890",
    "message": "Hello"
  }
}
```

- Success: Any phone number without "invalid"
- Failure: Phone numbers containing "invalid"

### 3. Webhook Post

```json
{
  "type": "webhook.post",
  "payload": {
    "url": "https://httpbin.org/post",
    "data": { "event": "test" }
  }
}
```

- Success: Any URL without "fail"
- Failure: URLs containing "fail"

### 4. Task Process

```json
{
  "type": "task.process",
  "payload": {
    "taskName": "Generate Report",
    "shouldFail": false,
    "failReason": "Optional error message"
  }
}
```

- Success: `shouldFail: false`
- Failure: `shouldFail: true`

---

## Priority Levels

Use the `priority` field when enqueuing (1 = highest, 10 = lowest):

- **1 (URGENT)**: Critical tasks
- **3 (HIGH)**: Important tasks
- **5 (NORMAL)**: Default priority
- **8 (LOW)**: Background tasks

Higher priority messages are processed first.

---

## Monitoring

### Worker Logs

The worker outputs detailed logs:

```
🔔 Notification received - new message available
🎯 Message dequeued: 550e8400-e29b-41d4-a716-446655440000

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Processing message:
   ID: 550e8400-e29b-41d4-a716-446655440000
   Type: email.send
   Priority: 5
   Retry: 0/3
   Payload: { to: 'user@example.com', subject: 'Test' }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   📧 Sending email to user@example.com...
   ✅ Email sent successfully
✅ Message processed successfully
```

### Queue Statistics (Every 30s)

```
📊 Queue Statistics:
   Pending: 5
   Processing: 1
   Completed: 42
   Failed: 2
   Dead Letter: 0
   Oldest message: 12s ago
```

---

## Testing Scenarios

### Scenario 1: Happy Path

1. Enqueue email with valid recipient
2. Worker processes instantly
3. Message marked as COMPLETED
4. Check stats: `completed++`

### Scenario 2: Retry Logic

1. Enqueue email with `fail@example.com`
2. Worker tries to process → fails
3. Message marked as FAILED, scheduled for retry
4. Worker retries after 1s, 2s, 4s (exponential backoff)
5. After 3 retries → moves to DEAD_LETTER

### Scenario 3: Priority Queue

1. Enqueue 3 messages:
   - Priority 8 (low)
   - Priority 1 (urgent)
   - Priority 5 (normal)
2. Worker processes in order: 1 → 5 → 8

### Scenario 4: Multiple Workers

1. Start 2 workers in separate terminals
2. Enqueue 10 messages
3. Both workers claim different messages (work-stealing)
4. No race conditions due to `FOR UPDATE SKIP LOCKED`

---

## Troubleshooting

### Worker Not Processing Messages

1. Check worker is running: `pnpm dev:worker`
2. Verify database connection
3. Check worker logs for errors
4. Query PENDING messages: `GET /messages/PENDING`

### Database Connection Error

```
ERROR: connection refused
```

**Solution**: Ensure PostgreSQL is running and `DATABASE_URL` is correct.

### Table Already Exists Error

The app uses `autoCreate: true`, so it's safe to run multiple times. If you see schema errors, check for manual migrations.

---

## Architecture

```
┌─────────────┐
│  Yaak/cURL  │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│  Hono API   │ (Port 3001)
│  (api.ts)   │
└──────┬──────┘
       │ Enqueue
       ▼
┌─────────────────────┐
│   PostgreSQL        │
│   test_queue table  │
│   LISTEN/NOTIFY     │
└──────┬──────────────┘
       │ Notification
       ▼
┌─────────────┐
│   Worker    │
│ (worker.ts) │
└─────────────┘
```

---

## Clean Up

### Stop Services

Press `Ctrl+C` in the terminal running `pnpm dev`

### Drop Queue Table

```sql
DROP TABLE IF EXISTS test_queue CASCADE;
```

---

## Next Steps

- Try different message types
- Test retry logic with failing messages
- Monitor queue statistics
- Run multiple workers to see work-stealing
- Experiment with priority levels
- Test graceful shutdown (Ctrl+C)

---

## Tech Stack

- **@systeric/pg-queue** (^0.2.0) - Message queue library
  - Published on npm: https://www.npmjs.com/package/@systeric/pg-queue
  - Uses workspace link in monorepo for development
  - Install from npm: `pnpm add @systeric/pg-queue`
- **Hono** - Lightweight web framework
- **PostgreSQL** - Database
- **TypeScript** - Type safety
- **tsx** - TypeScript execution
- **concurrently** - Run multiple processes

---

## Resources

- [pg-queue README](../../packages/pgmq/README.md)
- [Hono Documentation](https://hono.dev)
- [Yaak](https://yaak.app)
