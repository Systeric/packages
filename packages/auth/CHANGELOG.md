# Changelog

All notable changes to `@systeric/auth` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2025-11-17

### Changed

- Package now published to npm (`private: false`)
- Version bumped from 0.1.0 to 0.2.0

### Added

- Added MIT LICENSE file for legal clarity
- Added CHANGELOG.md for version tracking
- Added comprehensive package metadata for npm publishing
  - Repository, homepage, and bugs URLs
  - Package keywords for discoverability
  - Node.js engine requirements (>= 18.0.0)
  - Proper files configuration for npm package

## [0.1.0] - 2025-11-12

### Added

#### Domain Layer - Value Objects

- **AccessToken**: OAuth2 access token with expiry tracking
  - Automatic expiry detection with `isExpired()`
  - Proactive refresh detection with `needsRefresh()` (< 5 min until expiry)
  - Time-to-expiry calculation with `secondsUntilExpiry()`
  - JSON serialization support for storage
  - Type-safe token value access

- **RefreshToken**: Immutable refresh token with security features
  - Token masking for safe logging via `toMaskedString()`
  - Immutable design prevents accidental token exposure
  - JSON serialization support
  - Validation on creation

- **Scopes**: OAuth2 scopes with deduplication and validation
  - Predefined Google Calendar scopes via `Scopes.googleCalendar()`
  - Automatic scope deduplication
  - Scope merging with `merge()`
  - Scope addition with `add()`
  - Scope validation with `containsAll()`
  - OAuth2 format conversion (space-separated string)

- **AuthState**: CSRF protection state with expiry validation
  - Cryptographically secure state generation
  - Configurable TTL (default: 10 minutes)
  - State validation with expiry checking
  - Protection against CSRF attacks

#### Storage Layer

- **TokenStore** (Interface): Pluggable token storage
  - `save()` - Store tokens for a user
  - `get()` - Retrieve tokens for a user
  - `delete()` - Remove tokens for a user
  - `has()` - Check if tokens exist
  - `clear()` - Remove all tokens

- **InMemoryTokenStore**: In-memory token storage for development
  - Fast in-memory storage using Map
  - Full TokenStore interface implementation
  - Suitable for development and testing
  - Warning: Tokens lost on process restart

#### Adapter Layer

- **AuthAdapter** (Interface): OAuth provider abstraction
  - `getAuthorizationUrl()` - Generate OAuth consent URL
  - `exchangeCodeForTokens()` - Exchange auth code for tokens
  - `refreshAccessToken()` - Refresh expired access token
  - `revokeToken()` - Revoke access or refresh token

- **GoogleAdapter**: Google OAuth2 implementation
  - Full OAuth2 flow support
  - Authorization URL generation with scopes
  - Token exchange and refresh
  - Token revocation
  - Google Calendar scope presets

#### Service Layer

- **AuthService**: Main OAuth orchestration service
  - `getAuthorizationUrl()` - Start OAuth flow
  - `exchangeCodeForTokens()` - Complete OAuth flow with auto-storage
  - `refreshAccessToken()` - Refresh expired tokens with auto-storage
  - `getValidToken()` - Get valid token with automatic refresh
  - `revokeToken()` - Revoke tokens with auto-cleanup
  - Optional TokenStore integration for persistence
  - Transaction-like token operations
  - Converts raw TokenResponse to type-safe TokenSet

#### Error Handling

- **AuthError**: Base error class for authentication errors
  - Type-safe error handling
  - Consistent error messages
  - Proper error inheritance

#### Documentation

- Comprehensive README with:
  - Feature overview and architecture
  - Complete API reference
  - Value Objects documentation
  - Storage layer guide
  - Adapter pattern explanation
  - Full OAuth flow examples
  - Custom adapter creation guide
  - Token management strategies
  - Security best practices
  - Common Google OAuth scopes
  - Development commands

#### Testing

- **109 passing tests** with 100% domain coverage
- Unit tests for all Value Objects
- Unit tests for AuthService
- Unit tests for GoogleAdapter
- Unit tests for InMemoryTokenStore
- Vitest test framework
- Comprehensive test coverage reporting

#### Developer Experience

- Full TypeScript support with strict mode
- Zod schemas for runtime validation
- Comprehensive JSDoc comments
- ESLint configuration
- Type definitions included
- Clean architecture with separation of concerns

### Features

#### Core Capabilities

- **Domain-Driven Design**: Value Objects for type-safe token handling
- **Adapter Pattern**: Easy to add new OAuth providers
- **Automatic Token Refresh**: Auto-refresh tokens before expiry
- **Token Persistence**: Pluggable storage via TokenStore interface
- **CSRF Protection**: Built-in state validation with AuthState
- **Type Safety**: Zod schemas and TypeScript strict mode
- **Security First**: Token masking, expiry tracking, validation
- **Minimal Dependencies**: Only googleapis and zod

#### Supported Providers

- Google OAuth2 (via GoogleAdapter)
- Extensible for GitHub, Microsoft, GitLab, and custom providers

### Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.0 (optional, types included)

### Dependencies

- `googleapis` ^163.0.0 - Google OAuth2 client
- `zod` ^3.25.76 - Runtime validation

### Package Metadata

- **License**: MIT
- **Description**: Extensible OAuth2 authentication service with support for multiple providers
- **Main**: ./dist/index.js
- **Types**: ./dist/index.d.ts

### Notes

- This is the initial release (0.1.0)
- Package ready for production use
- 100% test coverage on domain layer
- Not yet published to npm (prepared for 0.2.0 release)

[0.2.0]: https://github.com/Systeric/packages/compare/@systeric/auth@0.1.0...@systeric/auth@0.2.0
[0.1.0]: https://github.com/Systeric/packages/tree/@systeric/auth@0.1.0/packages/auth
