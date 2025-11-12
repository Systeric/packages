#!/bin/bash

# @systeric/pg-queue - Publish Script
# One-command publish to npm

set -e  # Exit on error

echo "🚀 Publishing @systeric/pg-queue to npm..."
echo ""

# Pre-flight checks
echo "🔍 Pre-flight checks..."
echo ""

# Check 1: Verify npm login
echo "Checking npm authentication..."
if ! npm whoami > /dev/null 2>&1; then
  echo "❌ ERROR: Not logged in to npm"
  echo "   Please run: npm login"
  exit 1
fi
echo "✅ Logged in as: $(npm whoami)"
echo ""

# Check 2: Verify git status
echo "Checking git status..."
if [[ -n $(git status -s) ]]; then
  echo "⚠️  WARNING: Git working directory has uncommitted changes"
  git status -s
  echo ""
  read -p "Continue publishing with uncommitted changes? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publish cancelled. Please commit your changes first."
    exit 1
  fi
else
  echo "✅ Git working directory is clean"
fi
echo ""

# Step 1: Clean
echo "📦 Step 1/7: Cleaning old build..."
rm -rf dist
echo "✅ Clean complete"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2/7: Installing dependencies..."
pnpm install
echo "✅ Dependencies installed"
echo ""

# Step 3: Run tests
echo "🧪 Step 3/7: Running tests..."
pnpm test
echo "✅ All tests passed"
echo ""

# Step 4: Type check
echo "🔍 Step 4/7: Type checking..."
pnpm typecheck
echo "✅ Type check passed"
echo ""

# Step 5: Lint
echo "🎨 Step 5/7: Linting..."
pnpm lint
echo "✅ Linting passed"
echo ""

# Step 6: Build
echo "🏗️  Step 6/7: Building..."
pnpm build
echo "✅ Build complete"
echo ""

# Step 7: Publish
echo "📤 Step 7/7: Publishing to npm..."
echo ""
echo "⚠️  Please review the following before publishing:"
echo ""
echo "  Package: $(node -p "require('./package.json').name")"
echo "  Version: $(node -p "require('./package.json').version")"
echo "  Private: $(node -p "require('./package.json').private")"
echo ""
read -p "Continue with publish? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  # Check if private flag is set
  IS_PRIVATE=$(node -p "require('./package.json').private")
  if [ "$IS_PRIVATE" = "true" ]; then
    echo "❌ ERROR: Package is marked as private!"
    echo "   Set 'private: false' in package.json before publishing"
    exit 1
  fi

  # Publish with access public (required for scoped packages)
  npm publish --access public

  echo ""
  echo "✅ Published successfully!"
  echo ""
  echo "📦 Package: https://www.npmjs.com/package/@systeric/pg-queue"
  echo ""

  # Create git tag
  VERSION=$(node -p "require('./package.json').version")
  echo "🏷️  Creating git tag v$VERSION..."
  if git rev-parse "v$VERSION" >/dev/null 2>&1; then
    echo "⚠️  Tag v$VERSION already exists, skipping..."
  else
    git tag "v$VERSION"
    echo "✅ Tag v$VERSION created"
    echo ""
    echo "📤 Don't forget to push the tag:"
    echo "   git push origin v$VERSION"
  fi
  echo ""
else
  echo ""
  echo "❌ Publish cancelled"
  exit 1
fi
