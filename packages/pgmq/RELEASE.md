# Release Checklist - @systeric/pg-queue

## Pre-Release Verification

### ✅ Phase 1: Code Quality

- [x] All tests passing (89/89 tests)
- [x] Linting clean (no errors or warnings)
- [x] Type checking passes (tsc --noEmit)
- [x] Build succeeds (pnpm build)
- [x] 100% test coverage on domain layer

### ✅ Phase 2: Documentation

- [x] README.md complete with:
  - [x] Library clarification (not a service)
  - [x] Installation instructions
  - [x] FAQ format with all major use cases
  - [x] NestJS integration guide
  - [x] Multi-worker examples
  - [x] Idempotency patterns
  - [x] OpenTelemetry integration
  - [x] API reference
  - [x] Performance benchmarks
  - [x] Comparison with other queues
- [x] CHANGELOG.md created with v0.1.0 details
- [x] LICENSE file exists (MIT)
- [x] PUBLISHING.md guide exists
- [x] Release status section in README
- [x] Test count badge updated (89 tests)

### ✅ Phase 3: Package Configuration

- [x] package.json configured:
  - [x] `name`: @systeric/pg-queue
  - [x] `version`: 0.1.0
  - [x] `private`: false
  - [x] `description`: Clear library description
  - [x] `main`: ./dist/index.js
  - [x] `types`: ./dist/index.d.ts
  - [x] `exports`: Properly configured
  - [x] `files`: [dist, README.md, LICENSE]
  - [x] `keywords`: Comprehensive SEO keywords
  - [x] `repository`: GitHub URL
  - [x] `homepage`: Package homepage
  - [x] `bugs`: Issue tracker URL
  - [x] `license`: MIT
  - [x] `engines`: node >= 18.0.0
  - [x] `peerDependencies`: pg ^8.0.0
- [x] All exports verified in src/index.ts
- [x] prepublishOnly hook configured

### ✅ Phase 4: Build Verification

- [x] Clean build succeeds
- [x] dist/ folder generated correctly
- [x] Type declarations (.d.ts) generated
- [x] Declaration maps (.d.ts.map) generated
- [x] All modules exported correctly

---

## Release Process

### Option 1: Automated via Script (Recommended)

```bash
# Run the publishing script
pnpm run publish:npm

# Script will:
# 1. Clean old build
# 2. Install dependencies
# 3. Run tests
# 4. Type check
# 5. Lint
# 6. Build
# 7. Prompt for confirmation
# 8. Publish to npm with --access public
```

### Option 2: Manual Publishing

```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Clean build
rm -rf dist
pnpm install

# 3. Run all quality checks
pnpm test      # Should pass 89 tests
pnpm typecheck # Should have no errors
pnpm lint      # Should be clean

# 4. Build
pnpm build

# 5. Verify package contents
npm pack --dry-run

# 6. Publish (requires npm login)
npm publish --access public

# 7. Tag the release
git tag v0.2.0
git push origin v0.2.0
```

---

## Post-Release Checklist

### Immediate Actions

- [ ] Verify package on npm: https://www.npmjs.com/package/@systeric/pg-queue
- [ ] Test installation: `pnpm add @systeric/pg-queue`
- [ ] Create GitHub release: https://github.com/Systeric/packages/releases/new
  - Tag: v0.2.0
  - Title: "v0.2.0 - Enhanced Publishing"
  - Description: Copy from CHANGELOG.md
- [ ] Update README to reflect published status
- [ ] Announce on relevant channels (if applicable)

### Documentation Updates

- [ ] Update README installation section to remove "not yet published"
- [ ] Add npm badge to README
- [ ] Update version badge if needed

### Next Steps

- [ ] Monitor issues and questions on GitHub
- [ ] Plan v0.2.0 features based on feedback
- [ ] Consider adding integration tests (Phase 3)
- [ ] Evaluate additional examples/tutorials

---

## Version Bump Plan

### Current: 0.2.0 (Current Release)

**Next Minor (0.3.0)** - Planned Features:

- Integration tests with testcontainers
- Additional examples (Express, Fastify integrations)
- Performance optimization based on real-world usage
- Enhanced OpenTelemetry support
- Message batching support

**Next Patch (0.2.1)** - Bug Fixes Only:

- Critical bug fixes
- Documentation corrections
- Dependency updates

**Major (1.0.0)** - Stable API:

- API stabilization
- Full integration test coverage
- Production hardening
- Performance guarantees
- Breaking changes finalized

---

## Rollback Plan

If issues are discovered after publishing:

### Option 1: Deprecate Version

```bash
npm deprecate @systeric/pg-queue@0.2.0 "Issue discovered, please use 0.2.1"
```

### Option 2: Unpublish (within 72 hours)

```bash
npm unpublish @systeric/pg-queue@0.2.0
```

**Warning**: Only use if critical security issue or major breakage

### Option 3: Publish Fix Version

```bash
# Fix the issue
# Bump to 0.2.1
npm publish --access public
```

---

## Publishing Requirements

### npm Account Setup

1. Create npm account: https://www.npmjs.com/signup
2. Login locally: `npm login`
3. Verify login: `npm whoami`
4. Enable 2FA (recommended): https://www.npmjs.com/settings/~/tfa

### Organization Setup (Optional)

If publishing under @systeric org:

1. Create org: https://www.npmjs.com/org/create
2. Invite members
3. Configure access levels

### Access Tokens (for CI/CD)

```bash
# Create automation token
npm token create --type=automation

# Add to CI secrets as NPM_TOKEN
```

---

## Quality Gates

All must be ✅ before publishing:

| Check             | Status | Command            |
| ----------------- | ------ | ------------------ |
| Tests passing     | ✅     | `pnpm test`        |
| Linting clean     | ✅     | `pnpm lint`        |
| Type check        | ✅     | `pnpm typecheck`   |
| Build succeeds    | ✅     | `pnpm build`       |
| README complete   | ✅     | Manual review      |
| CHANGELOG updated | ✅     | Manual review      |
| Version correct   | ✅     | Check package.json |
| private: false    | ✅     | Check package.json |

---

## Success Metrics

After release, track:

- Weekly downloads on npm
- GitHub stars
- Issues opened vs resolved
- Community contributions
- Documentation questions (FAQ effectiveness)
- Performance reports from users

---

## Notes

- **Current Status**: Ready for release (all quality gates passed)
- **Target Date**: When ready to publish to npm
- **Breaking Changes**: None (initial release)
- **Migration Guide**: N/A (first release)

---

**Last Updated**: 2025-11-09
**Package Version**: 0.2.0
**Status**: ✅ Ready for Release
