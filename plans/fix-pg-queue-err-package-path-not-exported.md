# fix: ERR_PACKAGE_PATH_NOT_EXPORTED in Docker builds for @systeric/pg-queue

## Overview

When importing `@systeric/pg-queue` in a project that builds with Docker, the build fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` error. The package works correctly in local development environments.

## Problem Statement

**Error:** `ERR_PACKAGE_PATH_NOT_EXPORTED: No "exports" main defined in @systeric/pg-queue/package.json`

**Root Cause:** The package only exports ESM format without proper fallback conditions:

1. `exports` field lacks `require` condition (no CommonJS support)
2. `exports` field lacks `default` fallback
3. `types` condition is not first (TypeScript resolution issue)
4. `tsup.config.ts` only builds ESM: `format: ["esm"]`
5. `tsconfig.json` uses permissive `"moduleResolution": "bundler"` which masks issues in development

**Current Configuration:**

```json
// packages/pgmq/package.json:20-25
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

```typescript
// packages/pgmq/tsup.config.ts:5
format: ["esm"]; // Only ESM, no CJS
```

## Proposed Solution

Add dual ESM/CJS build support with properly structured exports field.

### Technical Approach

#### 1. Update tsup.config.ts

```typescript
// packages/pgmq/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"], // Build both formats
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "es2022",
  treeshake: true,
});
```

**Output files after change:**

- `dist/index.js` - ESM module (with `"type": "module"`)
- `dist/index.cjs` - CommonJS module
- `dist/index.d.ts` - TypeScript declarations

#### 2. Update package.json exports

```json
// packages/pgmq/package.json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "default": "./dist/index.js"
    }
  }
}
```

**Key changes:**

- `types` condition FIRST (required for TypeScript 5.0+)
- `import` condition for ESM consumers
- `require` condition for CommonJS consumers
- `default` fallback for unknown resolvers
- `main` points to CJS for legacy Node.js compatibility
- `module` field for legacy bundler compatibility

## Acceptance Criteria

- [ ] Package builds successfully with both ESM and CJS outputs
- [ ] ESM import works: `import { PgQueue } from '@systeric/pg-queue'`
- [ ] CJS require works: `const { PgQueue } = require('@systeric/pg-queue')`
- [ ] TypeScript types resolve correctly in both formats
- [ ] Docker build no longer throws ERR_PACKAGE_PATH_NOT_EXPORTED
- [ ] Existing local development workflows remain unaffected
- [ ] All existing tests pass
- [ ] Build output size is acceptable (estimate: ~70% increase)

## Implementation Steps

### Phase 1: Reproduce and Validate Bug

1. Create minimal Docker reproduction case
2. Verify ERR_PACKAGE_PATH_NOT_EXPORTED error occurs
3. Document exact error message and Node.js version

### Phase 2: Implement Fix

1. Update `packages/pgmq/tsup.config.ts`:
   - Change `format: ["esm"]` to `format: ["esm", "cjs"]`

2. Update `packages/pgmq/package.json`:
   - Restructure `exports` field with types-first ordering
   - Add `require` condition pointing to `.cjs` file
   - Add `default` fallback
   - Update `main` to point to CJS for legacy compatibility
   - Add `module` field for legacy bundler compatibility

3. Rebuild package:

   ```bash
   pnpm --filter @systeric/pg-queue run build
   ```

4. Verify output files exist:
   - `dist/index.js` (ESM)
   - `dist/index.cjs` (CJS)
   - `dist/index.d.ts` (types)

### Phase 3: Validate Fix

1. Run existing test suite:

   ```bash
   pnpm --filter @systeric/pg-queue test
   ```

2. Run typecheck:

   ```bash
   pnpm --filter @systeric/pg-queue run typecheck
   ```

3. Test ESM import:

   ```bash
   node --input-type=module -e "import('@systeric/pg-queue').then(m => console.log('ESM OK:', Object.keys(m)))"
   ```

4. Test CJS require:

   ```bash
   node -e "console.log('CJS OK:', Object.keys(require('@systeric/pg-queue')))"
   ```

5. Test Docker build (reproduce original issue and verify fix)

### Phase 4: Documentation and Release

1. Update CHANGELOG.md with fix description
2. Bump version appropriately (patch or minor)
3. Publish to npm

## Technical Considerations

### Dual Package Hazard

If both ESM and CJS versions are loaded in the same process, they will have separate module state. Review found no module-level singletons in `@systeric/pg-queue` that would cause issues. The `PgQueue` class instances are user-created, not shared.

### File Extension Strategy

With `"type": "module"` in package.json:

- `.js` files are treated as ESM
- `.cjs` files are treated as CommonJS
- tsup automatically generates correct extensions when `format: ["esm", "cjs"]`

### Dependency Compatibility

All dependencies support both ESM and CJS:

- `pg` - Dual format support
- `uuid` - Dual format support
- `zod` - Dual format support

### Backward Compatibility

This is a non-breaking change:

- Existing ESM imports continue to work
- New CJS require capability is additive
- TypeScript consumers benefit from types-first ordering

## Risk Analysis

| Risk                                    | Impact | Mitigation                                  |
| --------------------------------------- | ------ | ------------------------------------------- |
| Breaking existing ESM imports           | High   | Test ESM imports after change               |
| Dual package hazard (state duplication) | Medium | Codebase has no shared module state         |
| Increased package size                  | Low    | ~70% increase acceptable for compatibility  |
| TypeScript resolution issues            | Medium | Types-first ordering follows best practices |

## Success Metrics

1. Zero ERR_PACKAGE_PATH_NOT_EXPORTED errors in Docker builds
2. All 89 existing tests pass
3. Successful ESM and CJS consumption tests
4. No regressions in TypeScript type resolution

## Files to Modify

| File                               | Change                                               |
| ---------------------------------- | ---------------------------------------------------- |
| `packages/pgmq/tsup.config.ts:5`   | `format: ["esm"]` → `format: ["esm", "cjs"]`         |
| `packages/pgmq/package.json:18-25` | Restructure exports field with types/require/default |
| `packages/pgmq/CHANGELOG.md`       | Add entry for this fix                               |

## References

### Internal References

- `packages/pgmq/package.json:20-25` - Current exports configuration
- `packages/pgmq/tsup.config.ts:5` - Current build format
- `packages/pgmq/tsconfig.json:6` - moduleResolution setting

### External References

- [Node.js Packages Documentation](https://nodejs.org/api/packages.html)
- [TypeScript Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [ERR_PACKAGE_PATH_NOT_EXPORTED Solutions](https://bobbyhadz.com/blog/node-error-err-package-path-not-exported)
- [Dual Publishing ESM and CJS with tsup](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong)
