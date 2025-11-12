# @systeric/auth

Extensible OAuth2 authentication service with support for multiple providers via adapter pattern.

## Features

✅ **Domain-Driven Design** - Value Objects for type-safe token handling  
✅ **Adapter Pattern** - Easy to add new OAuth providers  
✅ **Automatic Token Refresh** - Auto-refresh tokens before expiry  
✅ **Token Persistence** - Pluggable storage with `TokenStore`  
✅ **CSRF Protection** - Built-in state validation with `AuthState`  
✅ **Type Safety** - Zod schemas and TypeScript strict mode  
✅ **Comprehensive Testing** - 109 tests with 100% coverage  
✅ **Security First** - Token masking, expiry tracking, validation

## Technical Plan

**Purpose**: Provide a secure, type-safe OAuth2 flow implementation with token management, supporting multiple authentication providers.

**Design Principles**:

- Domain-Driven Design with Value Objects
- Adapter pattern for extensibility (easy to add new providers)
- Single responsibility: OAuth authentication only
- Pluggable token storage via TokenStore interface
- Type-safe with Zod schemas and Value Objects
- Automatic token refresh before expiry
- CSRF protection with state validation
- Minimal dependencies

**Current Providers**:

- Google OAuth2 (via `GoogleAdapter`)

**Future Provider Support**:

- GitHub OAuth
- Microsoft OAuth
- GitLab OAuth
- Generic OAuth2 providers

## Architecture

The package uses **Domain-Driven Design** with Value Objects and the **Adapter Pattern**:

```typescript
// Domain Layer (Value Objects)
AccessToken    - Token with expiry tracking and refresh detection
RefreshToken   - Immutable token with security masking
Scopes         - OAuth scopes with deduplication
AuthState      - CSRF protection state with expiry

// Storage Layer
TokenStore (interface)
    ├── InMemoryTokenStore (for dev/testing)
    └── Your custom implementation (Redis, Database, etc.)

// Adapter Layer
AuthAdapter (interface)
    ├── GoogleAdapter
    ├── GitHubAdapter (future)
    └── MicrosoftAdapter (future)

// Service Layer
AuthService - Orchestrates auth flow with automatic token refresh
```

## Value Objects (Domain Layer)

### `AccessToken`

Represents an OAuth2 access token with expiry tracking.

```typescript
import { AccessToken } from "@systeric/auth";

// Create from token string and expiry seconds
const token = AccessToken.fromString("ya29.a0...", 3600);

// Check if expired
if (token.isExpired()) {
  // Token has expired
}

// Check if needs refresh (< 5 minutes until expiry)
if (token.needsRefresh()) {
  // Refresh token proactively
}

// Get time until expiry
const seconds = token.secondsUntilExpiry();

// Get token value
const value = token.getValue();

// Serialize for storage
const json = token.toJSON();
const restored = AccessToken.fromJSON(json);
```

### `RefreshToken`

Immutable refresh token with security masking for logging.

```typescript
import { RefreshToken } from "@systeric/auth";

const refreshToken = RefreshToken.fromString("1//abc123...");

// Get masked version for safe logging
console.log(refreshToken.toMaskedString()); // "1//***abc123"

// Get actual token value (use sparingly)
const value = refreshToken.getValue();

// Serialize for storage
const json = refreshToken.toJSON();
const restored = RefreshToken.fromJSON(json);
```

### `Scopes`

OAuth2 scopes with automatic deduplication and validation.

```typescript
import { Scopes } from "@systeric/auth";

// Predefined Google Calendar scopes
const scopes = Scopes.googleCalendar();
// ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/userinfo.email"]

// Or create custom
const custom = Scopes.fromArray(["scope1", "scope2"]);

// Add more scopes (deduplicates automatically)
const extended = scopes.add("https://www.googleapis.com/auth/drive");

// Merge with other scopes
const merged = scopes.merge(otherScopes);

// Check if contains specific scopes
if (scopes.containsAll(requiredScopes)) {
  // Has all required scopes
}

// Convert to OAuth2 format (space-separated)
const oauthString = scopes.toString(); // "scope1 scope2"

// Convert to array
const array = scopes.toArray();
```

### `AuthState`

CSRF protection state parameter with expiry validation.

```typescript
import { AuthState } from "@systeric/auth";

// Generate cryptographically secure state (default 10-min TTL)
const state = AuthState.generate();

// Custom TTL (in seconds)
const customState = AuthState.generate(600); // 10 minutes

// Get state value for OAuth URL
const stateParam = state.getValue();

// Later, validate received state
const receivedState = AuthState.fromString(receivedStateParam, 600);
if (state.validate(receivedState)) {
  // Valid state, proceed with OAuth
} else {
  // Invalid or expired state, reject request
}

// Check if expired
if (state.isExpired()) {
  // State has expired
}
```

## Token Storage

### `TokenStore` (Interface)

Interface for token persistence. Implement this for your storage backend.

```typescript
interface TokenStore {
  save(userId: string, data: StoredTokenData): Promise<void>;
  get(userId: string): Promise<StoredTokenData | null>;
  delete(userId: string): Promise<void>;
  has(userId: string): Promise<boolean>;
  clear(): Promise<void>;
}
```

### `InMemoryTokenStore`

Built-in in-memory implementation (for development/testing only).

```typescript
import { InMemoryTokenStore } from "@systeric/auth";

const tokenStore = new InMemoryTokenStore();

// ⚠️ WARNING: Tokens are lost on process restart
// Use for development/testing only
```

### Custom TokenStore Implementation

Example with Redis:

```typescript
import { TokenStore, StoredTokenData } from "@systeric/auth";
import { Redis } from "ioredis";

export class RedisTokenStore implements TokenStore {
  constructor(private redis: Redis) {}

  async save(userId: string, data: StoredTokenData): Promise<void> {
    await this.redis.set(
      `auth:tokens:${userId}`,
      JSON.stringify(data),
      "EX",
      86400 // 24 hour expiry
    );
  }

  async get(userId: string): Promise<StoredTokenData | null> {
    const json = await this.redis.get(`auth:tokens:${userId}`);
    if (!json) return null;

    try {
      return JSON.parse(json);
    } catch (error) {
      console.error(`Failed to parse token data for user ${userId}:`, error);
      return null;
    }
  }

  async delete(userId: string): Promise<void> {
    await this.redis.del(`auth:tokens:${userId}`);
  }

  async has(userId: string): Promise<boolean> {
    return (await this.redis.exists(`auth:tokens:${userId}`)) === 1;
  }

  async clear(): Promise<void> {
    const keys = await this.redis.keys("auth:tokens:*");
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

## API Contract

### `AuthAdapter` (Interface)

All auth adapters must implement this interface.

> **Note**: Adapters return `TokenResponse` (raw API data), which `AuthService` converts to `TokenSet` (Value Objects) for type-safe application use.

```typescript
interface AuthAdapter {
  getAuthorizationUrl(scopes: string[]): string;
  exchangeCodeForTokens(code: string): Promise<TokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<TokenResponse>;
  revokeToken(token: string): Promise<void>;
}
```

### `GoogleAdapter`

Adapter for Google OAuth2.

#### Constructor

```typescript
constructor(config: AuthConfig)
```

**Parameters**:

- `config` (AuthConfig):
  - `clientId` (string): Google OAuth2 client ID
  - `clientSecret` (string): Google OAuth2 client secret
  - `redirectUri` (string): OAuth callback URL

**Example**:

```typescript
import { GoogleAdapter } from "@systeric/auth";

const adapter = new GoogleAdapter({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: "http://localhost:3000/auth/google/callback",
});
```

### `AuthService`

Main service class that orchestrates OAuth flow with automatic token refresh.

#### Constructor

```typescript
constructor(adapter: AuthAdapter, store?: TokenStore)
```

**Parameters**:

- `adapter` (AuthAdapter): Auth adapter implementation
- `store` (TokenStore, optional): Token storage implementation for persistence

**Example**:

```typescript
import { AuthService, GoogleAdapter, InMemoryTokenStore } from "@systeric/auth";

const adapter = new GoogleAdapter({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: "http://localhost:3000/auth/google/callback",
});

// With token storage (recommended)
const tokenStore = new InMemoryTokenStore();
const authService = new AuthService(adapter, tokenStore);

// Without token storage (manual token management)
const authService = new AuthService(adapter);
```

#### Methods

##### `getAuthorizationUrl(scopes: string[]): string`

Generate OAuth2 authorization URL for user consent.

**Parameters**:

- `scopes` (string[]): Google OAuth2 scopes (e.g., calendar, email)

**Returns**: `string` - Authorization URL to redirect user

**Example**:

```typescript
const authUrl = authService.getAuthorizationUrl([
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
]);

// Redirect user to authUrl
response.redirect(authUrl);
```

##### `exchangeCodeForTokens(code: string, userId?: string): Promise<TokenSet>`

Exchange authorization code for access and refresh tokens.

**Parameters**:

- `code` (string): Authorization code from OAuth callback
- `userId` (string, optional): User ID to store tokens (requires TokenStore)

**Returns**: `Promise<TokenSet>` - Token set with Value Objects

- `accessToken` (AccessToken): Access token Value Object with expiry tracking
- `refreshToken` (RefreshToken, optional): Refresh token Value Object
- `scopes` (Scopes): OAuth scopes Value Object
- `tokenType` (string): Token type (usually 'Bearer')

**Example**:

```typescript
// In your OAuth callback handler (with auto-storage)
const tokens = await authService.exchangeCodeForTokens(
  request.query.code,
  userId // Automatically stores tokens
);

// Or manual storage
const tokens = await authService.exchangeCodeForTokens(request.query.code);
await storeUserTokens(userId, tokens);
```

##### `refreshAccessToken(refreshToken: string, userId?: string): Promise<TokenSet>`

Get a new access token using a refresh token.

**Parameters**:

- `refreshToken` (string): Previously obtained refresh token
- `userId` (string, optional): User ID to update stored tokens (requires TokenStore)

**Returns**: `Promise<TokenSet>` - New token set with Value Objects (refresh token may or may not be included)

**Example**:

```typescript
// When access token expires (with auto-storage)
const newTokens = await authService.refreshAccessToken(
  storedRefreshToken,
  userId // Automatically updates stored tokens
);

// Or manual storage
const newTokens = await authService.refreshAccessToken(storedRefreshToken);
await updateUserTokens(userId, newTokens);
```

##### `getValidToken(userId: string): Promise<AccessToken>`

**✨ New!** Get a valid access token for a user, automatically refreshing if expired or near expiry.

**Parameters**:

- `userId` (string): User ID

**Returns**: `Promise<AccessToken>` - Valid AccessToken Value Object

**Throws**:

- `TokenExpiredError` - If token expired and can't refresh
- `Error` - If no tokens found or TokenStore not configured

**Example**:

```typescript
import { google } from "googleapis";

// Automatically handles token refresh (< 5 min until expiry)
const accessToken = await authService.getValidToken(userId);

// Use with Google Calendar API
const calendar = google.calendar({
  version: "v3",
  auth: accessToken.getValue(),
});

// Always returns a valid, non-expired token
const events = await calendar.events.list({
  calendarId: "primary",
});
```

##### `revokeToken(token: string, userId?: string): Promise<void>`

Revoke an access or refresh token.

**Parameters**:

- `token` (string): Token to revoke
- `userId` (string, optional): User ID to remove from store (requires TokenStore)

**Returns**: `Promise<void>`

**Example**:

```typescript
// On user logout (with auto-cleanup)
await authService.revokeToken(user.accessToken, userId);

// Or manual cleanup
await authService.revokeToken(user.accessToken);
await deleteUserTokens(userId);
```

## Usage

### Installation

```bash
pnpm add @systeric/auth
```

### Complete OAuth Flow Example with Google

```typescript
import { AuthService, GoogleAdapter, InMemoryTokenStore, Scopes, AuthState } from "@systeric/auth";
import express from "express";
import { google } from "googleapis";

const app = express();

// Create adapter and token store
const adapter = new GoogleAdapter({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: "http://localhost:3000/auth/google/callback",
});

const tokenStore = new InMemoryTokenStore(); // Use Redis/DB in production
const authService = new AuthService(adapter, tokenStore);

// CSRF state storage (use Redis in production)
const authStates = new Map<string, AuthState>();

// Step 1: Initiate OAuth flow with CSRF protection
app.get("/auth/google", (req, res) => {
  const scopes = Scopes.googleCalendar(); // Predefined scopes
  const state = AuthState.generate(); // CSRF protection

  const authUrl = authService.getAuthorizationUrl(scopes.toArray());

  // Store state for validation
  authStates.set(state.getValue(), state);

  res.redirect(`${authUrl}&state=${state.getValue()}`);
});

// Step 2: Handle OAuth callback with state validation
app.get("/auth/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;

    // Validate CSRF state
    const storedState = authStates.get(state as string);
    if (!storedState) {
      return res.status(400).send("Invalid state");
    }

    const receivedState = AuthState.fromString(state as string, 600);
    if (!storedState.validate(receivedState)) {
      return res.status(400).send("State validation failed");
    }

    authStates.delete(state as string); // Clean up

    // Exchange code for tokens (auto-stores with userId)
    const userId = req.user.id; // From session/JWT
    await authService.exchangeCodeForTokens(code as string, userId);

    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send("Authentication failed");
  }
});

// Step 3: Use tokens (auto-refresh if needed)
app.get("/api/calendar/events", async (req, res) => {
  try {
    const userId = req.user.id;

    // Automatically refreshes if token expired or < 5min until expiry
    const accessToken = await authService.getValidToken(userId);

    // Use with Google Calendar API
    const calendar = google.calendar({
      version: "v3",
      auth: accessToken.getValue(),
    });

    const events = await calendar.events.list({
      calendarId: "primary",
    });

    res.json(events.data);
  } catch (error) {
    res.status(401).send("Not authenticated");
  }
});

// Step 4: Manual refresh (rarely needed with getValidToken)
app.post("/auth/refresh", async (req, res) => {
  try {
    const userId = req.user.id;
    const stored = await tokenStore.get(userId);

    if (!stored?.refreshToken) {
      return res.status(401).send("No refresh token");
    }

    const newTokens = await authService.refreshAccessToken(
      stored.refreshToken.getValue(),
      userId // Auto-updates stored tokens
    );

    res.json(newTokens);
  } catch (error) {
    res.status(401).send("Token refresh failed");
  }
});

// Step 5: Revoke on logout (auto-cleanup)
app.post("/auth/logout", async (req, res) => {
  try {
    const userId = req.user.id;
    const stored = await tokenStore.get(userId);

    if (stored) {
      await authService.revokeToken(
        stored.accessToken.getValue(),
        userId // Auto-removes from store
      );
    }

    res.send("Logged out successfully");
  } catch (error) {
    res.status(500).send("Logout failed");
  }
});
```

### Creating a Custom Adapter

You can create your own adapter for any OAuth provider by implementing the `AuthAdapter` interface:

```typescript
import { AuthAdapter, TokenResponse } from "@systeric/auth";

export class GitHubAdapter implements AuthAdapter {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: { clientId: string; clientSecret: string; redirectUri: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
  }

  getAuthorizationUrl(scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(" "),
      response_type: "code",
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    const data = await response.json();

    return {
      accessToken: data.access_token,
      scope: data.scope,
      tokenType: data.token_type,
      expiresIn: 0, // GitHub tokens don't expire
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    // GitHub doesn't support refresh tokens
    throw new Error("GitHub OAuth does not support token refresh");
  }

  async revokeToken(token: string): Promise<void> {
    await fetch(`https://api.github.com/applications/${this.clientId}/token`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: token }),
    });
  }
}

// Usage
const githubAdapter = new GitHubAdapter({
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: "http://localhost:3000/auth/github/callback",
});

const authService = new AuthService(githubAdapter);
```

### Token Management

```typescript
// Check if token is expired
function isTokenExpired(expiresIn: number, issuedAt: Date): boolean {
  const expiresAt = new Date(issuedAt.getTime() + expiresIn * 1000);
  return new Date() >= expiresAt;
}

// Automatic token refresh wrapper
async function getValidAccessToken(userId: string): Promise<string> {
  const user = await db.users.findById(userId);

  if (!user.tokens) {
    throw new Error("User not authenticated");
  }

  // Check if token is expired
  if (isTokenExpired(user.tokens.expiresIn, user.tokens.issuedAt)) {
    // Refresh the token
    const newTokens = await authService.refreshAccessToken(user.tokens.refreshToken);

    // Update in database
    await db.users.update(userId, {
      tokens: {
        ...newTokens,
        issuedAt: new Date(),
      },
    });

    return newTokens.accessToken;
  }

  return user.tokens.accessToken;
}
```

## Types

### `AuthConfig`

```typescript
interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}
```

### `TokenResponse`

```typescript
interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}
```

## Environment Variables

```bash
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

## Security Best Practices

1. **Never log tokens**: Access tokens and refresh tokens should never be logged
2. **Encrypt tokens at rest**: Store tokens encrypted in your database
3. **Use HTTPS**: Always use HTTPS in production for OAuth callbacks
4. **Short-lived access tokens**: Access tokens should expire quickly (1 hour)
5. **Secure storage**: Store refresh tokens securely with encryption
6. **Revoke on logout**: Always revoke tokens when user logs out

## Common Scopes

```typescript
// Calendar access
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

// Email access (read-only)
const EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

// Profile access
const PROFILE_SCOPE = "https://www.googleapis.com/auth/userinfo.profile";
```

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck
```

## License

Private - Systeric Internal Use
