# Systeric

> [!IMPORTANT]
> **This repository is archived.** `@systeric/pg-queue` is now developed in the
> [`Systeric/systeric-ops-platform`](https://github.com/Systeric/systeric-ops-platform)
> monorepo under [`packages/pgmq`](https://github.com/Systeric/systeric-ops-platform/tree/main/packages/pgmq).
> The published npm package (`@systeric/pg-queue`) is unchanged: `npm install @systeric/pg-queue`.
> The `auth` and `calendar` packages remain here, read-only, and are not currently maintained.

**Flawless features, reliably.**

Production-ready TypeScript libraries built with Domain-Driven Design and PostgreSQL-first architecture.

---

## Why Systeric?

**Built for Production from Day One**

Systeric packages aren't experiments or side projects—they're battle-tested libraries designed to go straight into production. Every package follows strict quality standards that ensure reliability, maintainability, and developer confidence.

### Our Philosophy

- **🏗️ Domain-Driven Design**: Rich domain models with Value Objects, Entities, and clear boundaries
- **✅ 100% Test Coverage**: Every line of code is tested. No exceptions.
- **🚀 Production-Ready**: Not experimental. Not beta. Ready for your production workloads.
- **🔷 TypeScript-First**: Full type safety with excellent IDE support and auto-completion
- **🐘 PostgreSQL-Powered**: Leverage PostgreSQL for queues, auth, and more—one database, infinite possibilities
- **⚡ Zero-Config to Advanced**: Simple defaults that work out of the box, configurable for complex use cases

---

## Packages

| Package                                       | Version                                                                | Description                                                               | Status            |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| **[@systeric/pg-queue](./packages/pgmq)**     | ![npm](https://img.shields.io/npm/v/@systeric/pg-queue)                | Message queue using PostgreSQL LISTEN/NOTIFY with work-stealing           | ✅ Published      |
| **[@systeric/auth](./packages/auth)**         | ![status](https://img.shields.io/badge/status-in%20development-orange) | OAuth2 authentication with automatic token refresh and PostgreSQL storage | 🚧 In Development |
| **[@systeric/calendar](./packages/calendar)** | ![status](https://img.shields.io/badge/status-in%20development-orange) | Calendar service abstraction for multiple providers                       | 🚧 In Development |

---

### [@systeric/pg-queue](./packages/pgmq)

A lightweight, high-performance TypeScript library that turns PostgreSQL into a message queue. Uses `LISTEN/NOTIFY` for instant message delivery and `FOR UPDATE SKIP LOCKED` for lock-free work-stealing across multiple workers.

**Features:**

- 🚀 Sub-10ms latency using LISTEN/NOTIFY
- 🔒 Zero race conditions with work-stealing
- 💾 ACID guarantees (messages are transactions)
- 🔄 Built-in retry logic with exponential backoff
- 📦 Dead letter queue for failed messages
- 🎯 Priority queues (1-10 levels)
- 🤖 Auto-consumption with handler registration
- ⚙️ Configurable concurrency control
- 🛡️ Graceful shutdown support

**Quick Start:**

```typescript
import { PgQueue } from "@systeric/pg-queue";

const queue = await PgQueue.create({
  connectionString: "postgresql://...",
  queueName: "emails",
});

// Register a handler
queue.registerHandler("welcome-email", async (message) => {
  await sendEmail(message.getPayload());
});

// Start auto-consumption
await queue.start({ concurrency: 10 });
```

[📚 Documentation](./packages/pgmq/README.md) | [📦 npm](https://www.npmjs.com/package/@systeric/pg-queue)

---

### [@systeric/auth](./packages/auth)

Extensible OAuth2 authentication service with support for multiple providers via adapter pattern.

**Features:**

- ✅ Domain-Driven Design with Value Objects
- ✅ Adapter Pattern for multiple OAuth providers
- ✅ Automatic token refresh before expiry
- ✅ Pluggable token storage (PostgreSQL included)
- ✅ CSRF protection with state validation
- ✅ Type-safe with Zod schemas
- ✅ Comprehensive testing (100% coverage)

**Quick Start:**

```typescript
import { OAuthService, GoogleOAuthAdapter } from "@systeric/auth";

const oauth = new OAuthService({
  adapter: new GoogleOAuthAdapter({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: "http://localhost:3000/callback",
  }),
});

// Generate authorization URL
const { url, state } = await oauth.getAuthorizationUrl({
  scopes: ["email", "profile"],
});

// Exchange code for tokens.
// `authCode` and `receivedState` are from the query parameters of the redirect URI.
const tokens = await oauth.exchangeCodeForTokens({
  code: authCode,
  state: receivedState,
});
```

[📚 Documentation](./packages/auth/README.md)

---

### [@systeric/calendar](./packages/calendar)

Extensible calendar service with support for multiple providers via adapter pattern.

**Features:**

- 📅 CRUD operations on calendar events
- 🔌 Adapter pattern for extensibility
- 🌍 UTC-first timezone handling
- 📆 14-day sync window support
- ✅ Type-safe with Zod schemas
- 🔐 Google Calendar support (more providers coming soon)

**Quick Start:**

```typescript
import { CalendarService, GoogleCalendarAdapter } from "@systeric/calendar";

const calendar = new CalendarService({
const calendar = new CalendarService({
  adapter: new GoogleCalendarAdapter({
    // The `tokens` object is obtained from the @systeric/auth package flow
    accessToken: tokens.accessToken,
  }),
});

// Create an event
await calendar.createEvent({
  summary: "Team Meeting",
  start: new Date("2025-01-15T10:00:00Z"),
  end: new Date("2025-01-15T11:00:00Z"),
});
```

[📚 Documentation](./packages/calendar/README.md)

---

## Quality Standards

We take quality seriously. Every Systeric package meets these standards:

### Testing

- ✅ **100% Code Coverage**: Every line of code is tested
- ✅ **Unit Tests**: All domain logic, value objects, and entities
- ✅ **Integration Tests**: Real database interactions, no mocks for critical paths
- ✅ **Type Safety**: Full TypeScript coverage with strict mode enabled

### Documentation

- ✅ **Comprehensive README**: Getting started, API docs, and examples
- ✅ **Inline Documentation**: JSDoc comments for all public APIs
- ✅ **Real-World Examples**: Production-ready code samples

### Code Quality

- ✅ **Domain-Driven Design**: Rich domain models, clear boundaries
- ✅ **SOLID Principles**: Clean, maintainable, extensible code
- ✅ **Error Handling**: Specific error types for programmatic handling
- ✅ **ESLint + Prettier**: Consistent code formatting

### Developer Experience

- ✅ **TypeScript-First**: Full type safety and IDE support
- ✅ **Zero-Config Defaults**: Works out of the box for simple use cases
- ✅ **Configurable**: Advanced options for complex scenarios
- ✅ **Clear Error Messages**: Actionable error messages

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL 13+ (for pg-queue)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm typecheck
```

### Development

```bash
# Run all apps in dev mode
pnpm dev

# Run specific package
pnpm --filter @systeric/pg-queue dev
pnpm --filter @systeric/auth dev
pnpm --filter @systeric/calendar dev
```

---

## Monorepo Structure

This is a turborepo with the following structure:

```
systeric-packages/
├── apps/
│   └── pg-queue-tester/     # POC application
├── packages/
│   ├── pgmq/                # @systeric/pg-queue library
│   ├── auth/                # @systeric/auth library
│   └── calendar/            # @systeric/calendar library
├── package.json             # Workspace configuration
├── turbo.json               # Turborepo pipeline
└── README.md                # This file
```

---

## Apps

### [pg-queue-tester](./apps/pg-queue-tester)

Proof-of-concept application demonstrating `@systeric/pg-queue` usage with:

- Hono API for enqueue/dequeue operations
- Event-driven worker for message processing
- Docker Compose for PostgreSQL
- Ready-to-use curl requests and Postman collection

[View Documentation](./apps/pg-queue-tester/README.md)

---

## Publishing

### Publish @systeric/pg-queue

```bash
pnpm run publish:pg-queue
```

This will:

1. Verify npm authentication
2. Check git working directory
3. Run tests
4. Build the package
5. Publish to npm
6. Create and push git tag

---

## Scripts

- `pnpm dev` - Run all apps in development mode
- `pnpm build` - Build all packages
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all code
- `pnpm typecheck` - Type check all code
- `pnpm format` - Format code with Prettier
- `pnpm publish:pg-queue` - Publish pg-queue to npm

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Read the Development Guidelines**: Check [CLAUDE.md](./CLAUDE.md) for our development standards
2. **Create an Issue**: Discuss your idea or bug report before starting work
3. **Follow TDD**: Write tests first, then implementation
4. **Maintain 100% Coverage**: All new code must be tested
5. **Use Conventional Commits**: Follow the conventional commit format

### Code Review Standards

- All PRs must pass CI checks (tests, lint, typecheck)
- Code must maintain 100% test coverage
- Documentation must be updated for API changes
- Follow the project's coding standards

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/Systeric/packages/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Systeric/packages/discussions)

---

**Built with ❤️ by Systeric**

_Flawless features, reliably._
