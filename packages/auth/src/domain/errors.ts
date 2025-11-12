/**
 * Base class for all auth-related errors
 */
export abstract class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when OAuth authorization fails
 */
export class AuthorizationError extends AuthError {
  constructor(
    message: string,
    public readonly provider: string
  ) {
    super(message, "AUTH_AUTHORIZATION_FAILED");
  }
}

/**
 * Thrown when token exchange fails
 */
export class TokenExchangeError extends AuthError {
  constructor(message: string) {
    super(message, "AUTH_TOKEN_EXCHANGE_FAILED");
  }
}

/**
 * Thrown when token refresh fails
 */
export class TokenRefreshError extends AuthError {
  constructor(message: string) {
    super(message, "AUTH_TOKEN_REFRESH_FAILED");
  }
}

/**
 * Thrown when token has expired
 */
export class TokenExpiredError extends AuthError {
  constructor(message: string = "Token has expired") {
    super(message, "AUTH_TOKEN_EXPIRED");
  }
}

/**
 * Thrown when token is invalid or malformed
 */
export class InvalidTokenError extends AuthError {
  constructor(message: string) {
    super(message, "AUTH_INVALID_TOKEN");
  }
}

/**
 * Thrown when state validation fails (CSRF protection)
 */
export class StateValidationError extends AuthError {
  constructor(message: string = "State validation failed") {
    super(message, "AUTH_STATE_VALIDATION_FAILED");
  }
}

/**
 * Thrown when scopes are insufficient
 */
export class InsufficientScopesError extends AuthError {
  constructor(required: string[], granted: string[]) {
    const missing = required.filter((s) => !granted.includes(s));
    super(`Missing required scopes: ${missing.join(", ")}`, "AUTH_INSUFFICIENT_SCOPES");
  }
}

/**
 * Thrown when OAuth provider configuration is invalid
 */
export class InvalidConfigError extends AuthError {
  constructor(message: string) {
    super(message, "AUTH_INVALID_CONFIG");
  }
}

/**
 * Thrown when token revocation fails
 */
export class TokenRevocationError extends AuthError {
  constructor(message: string) {
    super(message, "AUTH_TOKEN_REVOCATION_FAILED");
  }
}
