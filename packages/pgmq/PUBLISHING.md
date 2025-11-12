# Publishing @systeric/pg-queue to npm

## Quick Start

**From monorepo root:**

```bash
pnpm run publish:pg-queue
```

This will:

1. Navigate to packages/pgmq
2. Clean old builds
3. Install dependencies
4. Run tests
5. Type check
6. Lint code
7. Build TypeScript
8. Publish to npm (with confirmation)

## Prerequisites

### 1. npm Account & Authentication

You need to be logged in to npm:

```bash
npm login
```

Or create an account:

```bash
npm adduser
```

Verify you're logged in:

```bash
npm whoami
```

### 2. Organization Access

The package `@systeric/pg-queue` is scoped to the `@systeric` organization.

You need to be a member of the `@systeric` organization on npm, or:

**Option A**: Create the organization

```bash
npm org create systeric
```

**Option B**: Publish as yourself (change package name)

```json
{
  "name": "@your-username/pg-queue"
}
```

### 3. Package Configuration

Before publishing, update `package.json`:

```json
{
  "private": false, // IMPORTANT: Change from true to false!
  "version": "0.1.0" // Increment version for each publish
}
```

## Publishing Process

### First Time Publish

1. **Remove private flag**:

   ```bash
   # Edit package.json
   "private": false
   ```

2. **Run publish script**:

   ```bash
   cd packages/pgmq
   pnpm run publish:npm
   ```

3. **Verify publication**:
   ```bash
   npm view @systeric/pg-queue
   ```

### Subsequent Publishes

1. **Update version** in `package.json`:

   ```json
   {
     "version": "0.2.0" // Increment based on semver
   }
   ```

2. **Run publish**:
   ```bash
   pnpm run publish:npm
   ```

## Versioning (Semver)

Follow semantic versioning:

- **Patch** (0.1.0 → 0.1.1): Bug fixes
- **Minor** (0.1.0 → 0.2.0): New features, backwards compatible
- **Major** (0.1.0 → 1.0.0): Breaking changes

## Manual Publish (if script fails)

**From monorepo root:**

```bash
cd packages/pgmq

# Clean & build
rm -rf dist
pnpm install
pnpm test
pnpm build

# Publish
npm publish --access public
```

**Or use the package script directly:**

```bash
cd packages/pgmq
pnpm run publish:npm
```

## Dry Run (Test Without Publishing)

```bash
npm publish --dry-run
```

This shows what would be published without actually doing it.

## Unpublish (Emergency)

⚠️ **Only within 72 hours of publish**:

```bash
npm unpublish @systeric/pg-queue@0.1.0
```

## Post-Publish Checklist

- [ ] Verify on npm: https://www.npmjs.com/package/@systeric/pg-queue
- [ ] Test installation: `npm install @systeric/pg-queue`
- [ ] Check README renders correctly on npm
- [ ] Update GitHub releases
- [ ] Announce on Twitter/Discord/etc.

## Troubleshooting

### "You do not have permission to publish"

You're not logged in or don't have access to `@systeric` org.

**Fix**:

```bash
npm login
# Or change package name to your own scope
```

### "Package is marked as private"

`package.json` has `"private": true`.

**Fix**:

```json
{
  "private": false
}
```

### "Version already exists"

You're trying to publish a version that's already on npm.

**Fix**: Increment version in `package.json`

### "Missing README"

npm requires a README.

**Fix**: We have `README.md` ✅

### "Missing LICENSE"

npm warns without a license.

**Fix**: We have `LICENSE` file ✅

## Current Package Status

**Name**: @systeric/pg-queue
**Version**: 0.1.0
**Status**: ⚠️ Phase 1 Only (Domain Layer)
**Private**: true (change to false before publishing)

**What's Included**:

- ✅ Value objects (MessageId, MessageStatus, MessagePriority, QueueConfig)
- ✅ Entities (QueueMessage)
- ✅ Domain errors
- ✅ Full TypeScript types
- ✅ 85 passing tests

**What's Missing** (Phase 2):

- ❌ PgQueue main class
- ❌ Auto table creation
- ❌ LISTEN/NOTIFY integration
- ❌ PostgresQueueRepository

**Recommendation**: Complete Phase 2 before first npm publish, OR publish as `0.0.1` (pre-release) with clear warnings in README.
