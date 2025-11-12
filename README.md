# Systeric Packages

Open-source TypeScript packages by Systeric.

## Packages

### [@systeric/pg-queue](./packages/pgmq)

A lightweight, high-performance TypeScript library that turns PostgreSQL into a message queue. Uses `LISTEN/NOTIFY` for instant message delivery and `FOR UPDATE SKIP LOCKED` for lock-free work-stealing across multiple workers.

**Features:**
- 🚀 Sub-10ms latency using LISTEN/NOTIFY
- 🔒 Zero race conditions with work-stealing
- 💾 ACID guarantees (messages are transactions)
- 🔄 Built-in retry logic with exponential backoff
- 📦 Dead letter queue for failed messages
- 🎯 Priority queues (1-10 levels)

[View Documentation](./packages/pgmq/README.md) | [npm](https://www.npmjs.com/package/@systeric/pg-queue)

## Apps

### [pg-queue-tester](./apps/pg-queue-tester)

Proof-of-concept application demonstrating `@systeric/pg-queue` usage with:
- Hono API for enqueue/dequeue operations
- Event-driven worker for message processing
- Docker Compose for PostgreSQL
- Ready-to-use curl requests and Postman collection

[View Documentation](./apps/pg-queue-tester/README.md)

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
pnpm --filter @systeric/pg-queue-tester dev
```

---

## Monorepo Structure

This is a turborepo with the following structure:

```
systeric-packages/
├── apps/
│   └── pg-queue-tester/     # POC application
├── packages/
│   └── pgmq/                # @systeric/pg-queue library
├── package.json             # Workspace configuration
├── turbo.json               # Turborepo pipeline
└── README.md               # This file
```

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
6. Create git tag

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

Contributions are welcome! Please read [CLAUDE.md](./CLAUDE.md) for development guidelines.

---

## License

MIT

---

## Support

- **Issues**: [GitHub Issues](https://github.com/Systeric/packages/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Systeric/packages/discussions)

---

**Built with ❤️ by Systeric**
