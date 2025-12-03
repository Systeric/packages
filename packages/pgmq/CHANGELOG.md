# Changelog

All notable changes to `@systeric/pg-queue` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2025-12-03

### Added

- SSL/TLS configuration support via `ssl` option in `PgQueueConfig`
- Supports `ssl: true`, `ssl: false`, or `ssl: ConnectionOptions` from Node.js `tls` module
- Enables easy connection to cloud databases (DigitalOcean, AWS RDS, Heroku) without creating a custom Pool

## [0.3.1] - 2025-12-02

### Fixed

- Added CommonJS build to fix `ERR_PACKAGE_PATH_NOT_EXPORTED` error in Docker builds
- Updated package.json exports with proper types-first ordering, `require` condition, and `default` fallback
- Package now supports both ESM (`import`) and CommonJS (`require`)

### Changed

- Build output now includes both `dist/index.js` (ESM) and `dist/index.cjs` (CJS)
- `main` field now points to CJS for legacy Node.js compatibility
- Added `module` field for legacy bundler compatibility

## [0.2.2] - 2025-11-12

### Fixed

- **CRITICAL**: Changed all timestamp columns from TIMESTAMP to TIMESTAMPTZ to ensure UTC storage
- Fixed retry mechanism not working due to timezone mismatch between `next_retry_at` and `NOW()`
- All timestamps now stored in UTC for consistent cross-timezone behavior

### Breaking Changes

- Existing tables need to be dropped and recreated, or run this migration:
  ```sql
  ALTER TABLE your_table_name
    ALTER COLUMN next_retry_at TYPE TIMESTAMPTZ,
    ALTER COLUMN created_at TYPE TIMESTAMPTZ,
    ALTER COLUMN updated_at TYPE TIMESTAMPTZ;
  ```

## [0.2.1] - 2025-11-11

### Fixed

- ES module exports now work correctly in Node.js applications
- Switched from `tsc` to `tsup` for proper ESM bundling
- Added `"type": "module"` to package.json for ES module support

### Changed

- Build system migrated from TypeScript compiler to tsup for better ESM compatibility
- Updated tsconfig.json to use "bundler" moduleResolution

## [0.2.0] - 2025-11-09

### Added

- Enhanced publish script with pre-flight checks
  - npm authentication verification
  - Git working directory status check
  - Automatic git tag creation after publish
  - Improved error messages and user prompts

### Changed

- Version bump from 0.1.0 to 0.2.0
- Updated README badges to reflect v0.2.0

## [0.1.0] - 2025-11-09

### Added

#### Phase 1 - Domain Layer

- **Value Objects**: Immutable, self-validating domain primitives
  - `MessageId` - UUID v4 identifiers for messages
  - `MessageStatus` - Lifecycle states (PENDING, PROCESSING, COMPLETED, FAILED, DEAD_LETTER)
  - `MessagePriority` - Priority levels (1-10) with named constants (URGENT, HIGH, NORMAL, LOW)
  - `QueueConfig` - Queue configuration with validation

- **Entities**: Business logic and state management
  - `QueueMessage` - Core message entity with full lifecycle management
    - State transitions (PENDING → PROCESSING → COMPLETED/FAILED/DEAD_LETTER)
    - Retry logic with exponential backoff (1s, 2s, 4s, 8s, max 60s)
    - Visibility timeout detection for stale message recovery
    - Manual retry capability for failed messages

- **Domain Errors**: Typed error classes
  - `QueueError` - Base error for all queue operations
  - `MessageNotFoundError` - Message lookup failures
  - Custom error hierarchy for better error handling

#### Phase 2 - Infrastructure & Main API

- **Application Ports**: Clean architecture interfaces
  - `QueueRepository` - Repository interface for queue operations
  - Support for transactions via optional client parameter
  - `FindOptions` for flexible querying (limit, orderBy, order)
  - `QueueStats` interface for monitoring metrics

- **Infrastructure Layer**: PostgreSQL implementation
  - `PostgresQueueRepository` - Full repository implementation
    - `enqueue()` - Add messages to queue with transaction support
    - `dequeue()` - Claim messages using `FOR UPDATE SKIP LOCKED`
    - `ack()` - Mark messages as completed
    - `nack()` - Mark messages as failed with retry scheduling
    - `findById()` - Lookup messages by ID
    - `findByStatus()` - Query messages by status with pagination
    - `getStats()` - Queue health metrics
    - `resetStaleMessages()` - Recover stuck PROCESSING messages
    - `resetRetryableMessages()` - Reset FAILED messages ready for retry
    - `retry()` - Manually retry messages
    - `cleanupCompleted()` - Delete old completed messages
    - `cleanupDeadLetters()` - Delete old dead letter messages

- **SQL Generators**: Automatic schema management
  - `generateTableName()` - Random table names (systeric*queue*{6_chars})
  - `generateTableSQL()` - CREATE TABLE with constraints
  - `generateIndexesSQL()` - Performance indexes
    - Dequeue index (status, priority, created_at)
    - Retry index (status, next_retry_at)
    - Stale message index (status, updated_at)
    - Status index for stats queries
  - `generateNotifyTriggerSQL()` - LISTEN/NOTIFY triggers
  - `generateMigrationSQL()` - Complete migration SQL

- **Idempotency Handler**: Prevent duplicate execution
  - `IdempotencyHandler` - Database-backed idempotency
    - `initialize()` - Create idempotency_keys table
    - `execute()` - Run operations idempotently with result caching
    - `cleanup()` - Remove expired idempotency keys
    - `invalidate()` - Manually invalidate keys
    - Transaction support for atomic operations
    - Configurable TTL (default: 24 hours)

- **Main PgQueue Class**: High-level API
  - `PgQueue.create()` - Create queue with auto table creation
  - `PgQueue.generateMigration()` - Generate SQL for manual migrations
  - Auto table creation (idempotent, enabled by default)
  - Event-driven architecture with EventEmitter
  - LISTEN/NOTIFY for instant message delivery
  - Background jobs:
    - Stale message checker (configurable interval)
    - Retry checker for failed messages
  - Transaction support via `withTransaction()`
  - Graceful shutdown with `stop()`
  - Queue statistics and monitoring

- **Events**: Real-time queue monitoring
  - `enqueued` - Message added to queue
  - `dequeued` - Message claimed by worker
  - `ack` - Message completed successfully
  - `nack` - Message failed, scheduled for retry
  - `notification` - NOTIFY received from PostgreSQL
  - `stale:reset` - Stale messages recovered
  - `retry:reset` - Failed messages reset for retry
  - `started` - Queue listener started
  - `stopped` - Queue gracefully stopped
  - `error` - Error occurred

#### Documentation

- Comprehensive README with FAQ format
  - Installation guide (npm, pnpm, yarn)
  - Database setup (SQL + Prisma examples)
  - Message publishing (basic + transactions)
  - Message processing (event-driven + polling fallback)
  - NestJS integration guide
  - Horizontal scaling examples (multiple workers)
  - Worker crash recovery (visibility timeout)
  - Retry logic documentation
  - Dead Letter Queue handling
  - Transactional Outbox Pattern guide
  - Idempotency patterns and `IdempotencyHandler` usage
  - Performance benchmarks
  - OpenTelemetry integration (tracing + metrics)
  - Testing strategies (unit + integration)
  - API reference
  - Comparison with BullMQ, SQS, RabbitMQ

- Auto table creation design document
- Implementation roadmap with phase breakdown
- Publishing guide for npm releases

#### Testing

- 85+ passing tests (100% coverage on domain layer)
- Unit tests for all value objects and entities
- Repository integration test structure
- MSW for API mocking examples
- Vitest test framework

#### Developer Experience

- Full TypeScript support with strict mode
- Zero `@types` packages needed
- Comprehensive JSDoc comments
- Publishing script with pre-publish checks
- ESLint + Prettier configuration
- Husky pre-commit hooks

### Features

#### Core Capabilities

- **Event-Driven Delivery**: Sub-10ms latency via LISTEN/NOTIFY
- **Work-Stealing**: `FOR UPDATE SKIP LOCKED` prevents race conditions
- **ACID Guarantees**: Messages participate in database transactions
- **Auto Retry**: Exponential backoff with configurable max retries
- **Dead Letter Queue**: Automatic DLQ for exhausted retries
- **Visibility Timeout**: Automatic recovery of crashed workers
- **Priority Queue**: 10 priority levels with named constants
- **Idempotent Operations**: Built-in duplicate prevention
- **Horizontal Scaling**: Linear scaling across multiple workers
- **Zero Infrastructure**: Just PostgreSQL 13+ required
- **Auto Schema Management**: Tables/indexes/triggers created automatically
- **Migration Support**: Generate SQL for version control
- **Graceful Shutdown**: Clean worker termination
- **Comprehensive Monitoring**: Stats, metrics, and event streams
- **Transaction Support**: Transactional outbox pattern built-in

#### Performance

- **Notification Latency**: < 10ms (LISTEN/NOTIFY)
- **Dequeue Latency**: 20-50ms (single query)
- **Throughput**: 100-500 msg/sec per worker
- **Multi-Worker**: 90%+ efficiency with 10 workers
- **Database Load**: ~3 queries per message
- **Memory**: < 100MB per worker instance

#### Limitations Documented

- PostgreSQL 13+ required (FOR UPDATE SKIP LOCKED)
- Message payload practical limit: ~10MB
- No strict message ordering within same priority
- One persistent connection per worker required

### Requirements

- Node.js >= 18.0.0
- PostgreSQL >= 13.0
- TypeScript >= 5.0 (optional, types included)

### Dependencies

- `pg` ^8.13.1 - PostgreSQL client
- `uuid` ^11.0.5 - Message ID generation
- `zod` ^3.25.76 - Runtime validation

### Package Metadata

- **License**: MIT
- **Repository**: https://github.com/Systeric/packages
- **Homepage**: https://github.com/Systeric/packages/tree/main/packages/pgmq
- **Keywords**: postgresql, message-queue, queue, work-stealing, listen-notify, outbox-pattern, event-driven, background-jobs, task-queue, distributed-systems, ddd

### Notes

- This is the initial release (0.1.0)
- Package is ready for production use
- Domain layer has 100% test coverage
- Infrastructure layer tested via integration tests
- Not yet published to npm (private: false set, ready to publish)

[0.1.0]: https://github.com/Systeric/packages/tree/main/packages/pgmq
