# feat: Add SSL configuration support to @systeric/pg-queue

## Overview

Add `ssl` option to `PgQueueConfig` so users can connect to SSL-enabled cloud databases without creating their own Pool.

## Problem Statement

When using `PgQueue.create()` with a `connectionString`, the package creates a Pool without SSL config:

```typescript
// packages/pgmq/src/PgQueue.ts:180
const pool = config.pool || new Pool({ connectionString: config.connectionString });
```

This causes `SELF_SIGNED_CERT_IN_CHAIN` errors with cloud databases (DigitalOcean, AWS RDS, Heroku).

**Current workaround:**

```typescript
const pool = new Pool({
  connectionString: "postgresql://...",
  ssl: { rejectUnauthorized: false },
});
const queue = await PgQueue.create({ pool, queueName: "my-queue" });
```

**Desired:**

```typescript
const queue = await PgQueue.create({
  connectionString: "postgresql://...",
  ssl: { rejectUnauthorized: false },
  queueName: "my-queue",
});
```

## Solution

Add `ssl?: boolean | ConnectionOptions` to `PgQueueConfig` and pass it to Pool constructor.

## Implementation

### 1. Update PgQueueConfig Interface

```typescript
// packages/pgmq/src/PgQueue.ts
import type { ConnectionOptions } from "tls";

export interface PgQueueConfig {
  connectionString?: string;
  pool?: Pool;
  /** SSL config for database connections. Ignored if pool is provided. */
  ssl?: boolean | ConnectionOptions;
  queueName: string;
  autoCreate?: boolean;
  visibilityTimeoutMs?: number;
  pollIntervalMs?: number;
  maxRetries?: number;
}
```

### 2. Update Pool Creation

```typescript
// packages/pgmq/src/PgQueue.ts:180
const pool =
  config.pool ||
  new Pool({
    connectionString: config.connectionString,
    ssl: config.ssl,
  });
```

That's it. No warnings, no re-exports, no extra abstractions.

## Acceptance Criteria

- [ ] `ssl` option added to `PgQueueConfig` interface
- [ ] SSL config passed to Pool when using `connectionString`
- [ ] `ssl` silently ignored when `pool` is provided (documented, no warning)
- [ ] Existing tests pass
- [ ] Unit tests verify SSL passthrough
- [ ] README updated with SSL example
- [ ] CHANGELOG updated

## Files to Modify

| File                                 | Change                                                |
| ------------------------------------ | ----------------------------------------------------- |
| `packages/pgmq/src/PgQueue.ts:1`     | Add `import type { ConnectionOptions } from 'tls'`    |
| `packages/pgmq/src/PgQueue.ts:25-68` | Add `ssl?: boolean \| ConnectionOptions` to interface |
| `packages/pgmq/src/PgQueue.ts:180`   | Pass `ssl` to Pool constructor                        |
| `packages/pgmq/src/PgQueue.test.ts`  | Add 2 unit tests                                      |
| `packages/pgmq/README.md`            | Add SSL section                                       |
| `packages/pgmq/CHANGELOG.md`         | Add v0.4.0 entry                                      |

## Tests

```typescript
describe("SSL configuration", () => {
  it("passes ssl config to Pool constructor", async () => {
    // Mock Pool, verify ssl: { rejectUnauthorized: false } is passed
  });

  it("creates Pool without ssl when not provided", async () => {
    // Mock Pool, verify ssl is undefined
  });
});
```

## Documentation

Add to README.md:

````markdown
## SSL Configuration

For cloud databases requiring SSL (DigitalOcean, AWS RDS, Heroku):

```typescript
const queue = await PgQueue.create({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  queueName: "emails",
});
```
````

> **Note:** `rejectUnauthorized: false` disables certificate verification.
> See [node-postgres SSL docs](https://node-postgres.com/features/ssl) for more options.

````

## CHANGELOG Entry

```markdown
## [0.4.0] - 2025-12-XX

### Added
- SSL/TLS configuration support via `ssl` option in `PgQueueConfig`
- Supports `ssl: true`, `ssl: false`, or `ssl: ConnectionOptions` from Node.js `tls` module
````

## Backward Compatibility

Non-breaking, additive change:

- `ssl` is optional
- Existing code works identically
- Semver: **MINOR** version bump (0.3.x → 0.4.0)

## Design Decisions

1. **No console.warn** - Trust users. If they provide both `pool` and `ssl`, the `ssl` is silently ignored (pool is already configured).

2. **No re-export of ConnectionOptions** - Users can import from `tls` directly.

3. **No integration tests** - Unit tests verify passthrough. Testing actual SSL connections tests the `pg` library, not our code.

4. **Minimal documentation** - One example + link to pg docs. Provider-specific examples get outdated quickly.

5. **Let pg errors propagate** - No wrapping. SSL errors surface during `PgQueue.create()` when `ensureTableExists()` runs.

## References

- `packages/pgmq/src/PgQueue.ts:25-68` - Current PgQueueConfig
- `packages/pgmq/src/PgQueue.ts:180` - Pool creation
- [node-postgres SSL docs](https://node-postgres.com/features/ssl)
