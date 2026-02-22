/** Base class for all typed application errors. */
export abstract class AppError extends Error {
  abstract readonly code: string

  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
    // Maintains proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype)
  }

  toJSON(): { code: string; message: string; details?: unknown } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

export class PermissionDeniedError extends AppError {
  readonly code = 'PERMISSION_DENIED'
}

export class ModuleNotFoundError extends AppError {
  readonly code = 'MODULE_NOT_FOUND'
}

export class ModuleInstallError extends AppError {
  readonly code = 'MODULE_INSTALL_FAILED'
}

export class ModuleVersionIncompatibleError extends AppError {
  readonly code = 'MODULE_VERSION_INCOMPATIBLE'
}

export class SignatureVerificationError extends AppError {
  readonly code = 'SIGNATURE_VERIFICATION_FAILED'
}

export class GatewayError extends AppError {
  readonly code = 'GATEWAY_ERROR'
}

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED'
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR'
}

export class AuthError extends AppError {
  readonly code = 'AUTH_ERROR'
}

export class BudgetExceededError extends AppError {
  readonly code = 'BUDGET_EXCEEDED'
}

export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT'
}

export class ToolExecutionError extends AppError {
  readonly code = 'TOOL_EXECUTION_FAILED'
}
