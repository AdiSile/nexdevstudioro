/**
 * Global Error Handler — Error Codes, i18n Messages, Status Codes, Stack Trace Sanitization
 *
 * Production-grade centralized error handling with structured error codes,
 * internationalized user-facing messages, HTTP status code mapping, and
 * safe stack trace sanitization for logging and monitoring.
 *
 * Architecture:
 *   1. ErrorCode Registry — exhaustive enum of all application error codes
 *      organized by domain (auth, validation, db, billing, rate-limit, etc.)
 *   2. AppError Class — structured error with code, statusCode, i18n key,
 *      safe message, optional cause chaining, and metadata
 *   3. Status Code Mapping — every error code maps to an HTTP status code
 *      following RFC 9110 and REST conventions
 *   4. i18n Integration — error codes map to translation keys consumed by
 *      next-intl; fallback messages in English and Romanian
 *   5. Stack Trace Sanitization — removes project paths, normalizes node_modules
 *      frames, filters noise, protects sensitive data in traces
 *   6. Error Serialization — safe JSON serialization for API responses,
 *      logging, and monitoring (no leaking of internals)
 *   7. Error Response Builder — builds consistent error response bodies
 *      with code, message, requestId, timestamp, and optional details
 *   8. isAppError / isKnownError Type Guards — narrow error types for
 *      catch blocks without fragile instanceof checks
 *
 * Error Code Naming Convention:
 *   DOMAIN_SUBCATEGORY_DESCRIPTION
 *
 *   Examples:
 *     AUTH_INVALID_CREDENTIALS
 *     VALIDATION_REQUIRED_FIELD
 *     DB_UNIQUE_CONSTRAINT
 *     BILLING_INSUFFICIENT_FUNDS
 *     RATE_LIMIT_EXCEEDED
 *
 * Environment Variables:
 *   ERROR_HANDLER_EXPOSE_STACK    — include stack traces in dev responses (default: false in prod)
 *   ERROR_HANDLER_MAX_TRACE_DEPTH — max stack frames in sanitized trace (default: 20)
 *   ERROR_HANDLER_STRIP_BASE_PATH — base path to strip from traces (default: cwd)
 *   ERROR_HANDLER_DEFAULT_LOCALE  — fallback locale for error messages (default: "en")
 *
 * Usage — Throwing:
 *   import { AppError, ErrorCode } from "@/lib/error-handler";
 *
 *   throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, {
 *     message: "Email or password is incorrect",
 *     cause: originalError,
 *     metadata: { email: userEmail },
 *   });
 *
 * Usage — Catching & Responding:
 *   import { handleError, buildErrorResponse, isAppError } from "@/lib/error-handler";
 *
 *   try {
 *     await someOperation();
 *   } catch (err) {
 *     const response = buildErrorResponse(err, { requestId: "req_abc" });
 *     return NextResponse.json(response.body, { status: response.status });
 *   }
 *
 * Usage — i18n (client-side):
 *   import { getErrorMessage, getErrorCodeI18nKey } from "@/lib/error-handler";
 *
 *   const key = getErrorCodeI18nKey(error.code);
 *   const message = t(key, { fallback: error.message });
 */

// ---------------------------------------------------------------------------
// Error Code Registry
// ---------------------------------------------------------------------------

/**
 * All application error codes organized by domain.
 *
 * Each code maps to:
 *   - An HTTP status code (defined in ERROR_CODE_STATUS_MAP)
 *   - An i18n translation key (derived by convention: `errors.<lower_snake_code>`)
 *   - A fallback message in English
 */
export const ErrorCode = {
  // === Generic / System ===
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT",
  DEPENDENCY_FAILURE: "DEPENDENCY_FAILURE",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",

  // === Authentication & Authorization ===
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  AUTH_ACCOUNT_DISABLED: "AUTH_ACCOUNT_DISABLED",
  AUTH_ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_MISSING: "AUTH_TOKEN_MISSING",
  AUTH_TWO_FACTOR_REQUIRED: "AUTH_TWO_FACTOR_REQUIRED",
  AUTH_TWO_FACTOR_INVALID: "AUTH_TWO_FACTOR_INVALID",
  AUTH_RECOVERY_CODE_INVALID: "AUTH_RECOVERY_CODE_INVALID",
  AUTH_OAUTH_ERROR: "AUTH_OAUTH_ERROR",
  AUTH_OAUTH_ACCOUNT_EXISTS: "AUTH_OAUTH_ACCOUNT_EXISTS",
  AUTH_PASSWORD_TOO_WEAK: "AUTH_PASSWORD_TOO_WEAK",
  AUTH_PASSWORD_REUSE: "AUTH_PASSWORD_REUSE",
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",
  AUTH_INSUFFICIENT_ROLE: "AUTH_INSUFFICIENT_ROLE",
  AUTH_INSUFFICIENT_PERMISSION: "AUTH_INSUFFICIENT_PERMISSION",
  AUTH_CSRF_INVALID: "AUTH_CSRF_INVALID",

  // === Validation ===
  VALIDATION_ERROR: "VALIDATION_ERROR",
  VALIDATION_REQUIRED_FIELD: "VALIDATION_REQUIRED_FIELD",
  VALIDATION_INVALID_FORMAT: "VALIDATION_INVALID_FORMAT",
  VALIDATION_INVALID_EMAIL: "VALIDATION_INVALID_EMAIL",
  VALIDATION_INVALID_URL: "VALIDATION_INVALID_URL",
  VALIDATION_MIN_LENGTH: "VALIDATION_MIN_LENGTH",
  VALIDATION_MAX_LENGTH: "VALIDATION_MAX_LENGTH",
  VALIDATION_MIN_VALUE: "VALIDATION_MIN_VALUE",
  VALIDATION_MAX_VALUE: "VALIDATION_MAX_VALUE",
  VALIDATION_PATTERN_MISMATCH: "VALIDATION_PATTERN_MISMATCH",
  VALIDATION_UNIQUE_CONSTRAINT: "VALIDATION_UNIQUE_CONSTRAINT",
  VALIDATION_ENUM_VALUE: "VALIDATION_ENUM_VALUE",
  VALIDATION_TYPE_MISMATCH: "VALIDATION_TYPE_MISMATCH",
  VALIDATION_FILE_TOO_LARGE: "VALIDATION_FILE_TOO_LARGE",
  VALIDATION_FILE_TYPE: "VALIDATION_FILE_TYPE",
  VALIDATION_PASSWORD_MISMATCH: "VALIDATION_PASSWORD_MISMATCH",

  // === Resource (CRUD) ===
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  RESOURCE_DELETED: "RESOURCE_DELETED",
  RESOURCE_LOCKED: "RESOURCE_LOCKED",
  RESOURCE_EXPIRED: "RESOURCE_EXPIRED",
  RESOURCE_IMMUTABLE: "RESOURCE_IMMUTABLE",
  RESOURCE_DEPENDENCY: "RESOURCE_DEPENDENCY",

  // === Database ===
  DB_ERROR: "DB_ERROR",
  DB_CONNECTION: "DB_CONNECTION",
  DB_TIMEOUT: "DB_TIMEOUT",
  DB_UNIQUE_CONSTRAINT: "DB_UNIQUE_CONSTRAINT",
  DB_FOREIGN_KEY: "DB_FOREIGN_KEY",
  DB_NOT_NULL: "DB_NOT_NULL",
  DB_CHECK_CONSTRAINT: "DB_CHECK_CONSTRAINT",
  DB_MIGRATION: "DB_MIGRATION",
  DB_TRANSACTION: "DB_TRANSACTION",

  // === Rate Limiting ===
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  RATE_LIMIT_IP: "RATE_LIMIT_IP",
  RATE_LIMIT_USER: "RATE_LIMIT_USER",
  RATE_LIMIT_API_KEY: "RATE_LIMIT_API_KEY",
  RATE_LIMIT_GLOBAL: "RATE_LIMIT_GLOBAL",
  RATE_LIMIT_PENALTY: "RATE_LIMIT_PENALTY",

  // === Billing & Payments ===
  BILLING_ERROR: "BILLING_ERROR",
  BILLING_INSUFFICIENT_FUNDS: "BILLING_INSUFFICIENT_FUNDS",
  BILLING_CARD_DECLINED: "BILLING_CARD_DECLINED",
  BILLING_CARD_EXPIRED: "BILLING_CARD_EXPIRED",
  BILLING_CARD_INVALID: "BILLING_CARD_INVALID",
  BILLING_INVALID_COUPON: "BILLING_INVALID_COUPON",
  BILLING_COUPON_EXPIRED: "BILLING_COUPON_EXPIRED",
  BILLING_PLAN_NOT_FOUND: "BILLING_PLAN_NOT_FOUND",
  BILLING_PLAN_INCOMPATIBLE: "BILLING_PLAN_INCOMPATIBLE",
  BILLING_INVOICE_NOT_FOUND: "BILLING_INVOICE_NOT_FOUND",
  BILLING_SUBSCRIPTION_EXPIRED: "BILLING_SUBSCRIPTION_EXPIRED",
  BILLING_SUBSCRIPTION_CANCELLED: "BILLING_SUBSCRIPTION_CANCELLED",
  BILLING_PAYMENT_METHOD_REQUIRED: "BILLING_PAYMENT_METHOD_REQUIRED",
  BILLING_TAX_CALCULATION: "BILLING_TAX_CALCULATION",
  BILLING_CURRENCY_NOT_SUPPORTED: "BILLING_CURRENCY_NOT_SUPPORTED",
  BILLING_PROVIDER_ERROR: "BILLING_PROVIDER_ERROR",
  BILLING_WEBHOOK_INVALID: "BILLING_WEBHOOK_INVALID",

  // === File / Storage ===
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FILE_TYPE_NOT_ALLOWED: "FILE_TYPE_NOT_ALLOWED",
  FILE_UPLOAD_FAILED: "FILE_UPLOAD_FAILED",
  FILE_DOWNLOAD_FAILED: "FILE_DOWNLOAD_FAILED",
  FILE_STORAGE_FULL: "FILE_STORAGE_FULL",
  FILE_MALWARE_DETECTED: "FILE_MALWARE_DETECTED",
  FILE_PROCESSING_FAILED: "FILE_PROCESSING_FAILED",

  // === AI / ML ===
  AI_PROVIDER_ERROR: "AI_PROVIDER_ERROR",
  AI_TOKEN_LIMIT: "AI_TOKEN_LIMIT",
  AI_CONTENT_FILTER: "AI_CONTENT_FILTER",
  AI_MODEL_NOT_FOUND: "AI_MODEL_NOT_FOUND",
  AI_MODEL_OVERLOADED: "AI_MODEL_OVERLOADED",
  AI_QUOTA_EXCEEDED: "AI_QUOTA_EXCEEDED",
  AI_INVALID_PROMPT: "AI_INVALID_PROMPT",
  AI_GENERATION_FAILED: "AI_GENERATION_FAILED",
  AI_EMBEDDING_FAILED: "AI_EMBEDDING_FAILED",

  // === Search ===
  SEARCH_INDEX_ERROR: "SEARCH_INDEX_ERROR",
  SEARCH_QUERY_INVALID: "SEARCH_QUERY_INVALID",
  SEARCH_INDEX_NOT_FOUND: "SEARCH_INDEX_NOT_FOUND",
  SEARCH_SERVICE_UNAVAILABLE: "SEARCH_SERVICE_UNAVAILABLE",

  // === Communication ===
  EMAIL_SEND_FAILED: "EMAIL_SEND_FAILED",
  EMAIL_TEMPLATE_NOT_FOUND: "EMAIL_TEMPLATE_NOT_FOUND",
  EMAIL_RATE_LIMITED: "EMAIL_RATE_LIMITED",
  SMS_SEND_FAILED: "SMS_SEND_FAILED",
  PUSH_NOTIFICATION_FAILED: "PUSH_NOTIFICATION_FAILED",
  WEBHOOK_DELIVERY_FAILED: "WEBHOOK_DELIVERY_FAILED",

  // === Integration / API ===
  INTEGRATION_ERROR: "INTEGRATION_ERROR",
  INTEGRATION_AUTH_FAILED: "INTEGRATION_AUTH_FAILED",
  INTEGRATION_WEBHOOK_INVALID: "INTEGRATION_WEBHOOK_INVALID",
  INTEGRATION_RATE_LIMITED: "INTEGRATION_RATE_LIMITED",
  INTEGRATION_CONFIG_INVALID: "INTEGRATION_CONFIG_INVALID",
  THIRD_PARTY_API_ERROR: "THIRD_PARTY_API_ERROR",

  // === Tenant / Organization ===
  TENANT_NOT_FOUND: "TENANT_NOT_FOUND",
  TENANT_DISABLED: "TENANT_DISABLED",
  TENANT_QUOTA_EXCEEDED: "TENANT_QUOTA_EXCEEDED",
  TENANT_FEATURE_DISABLED: "TENANT_FEATURE_DISABLED",
  TENANT_USER_LIMIT: "TENANT_USER_LIMIT",

  // === Request ===
  REQUEST_INVALID: "REQUEST_INVALID",
  REQUEST_BODY_TOO_LARGE: "REQUEST_BODY_TOO_LARGE",
  REQUEST_BODY_MALFORMED: "REQUEST_BODY_MALFORMED",
  REQUEST_HEADER_MISSING: "REQUEST_HEADER_MISSING",
  REQUEST_HEADER_INVALID: "REQUEST_HEADER_INVALID",
  REQUEST_QUERY_INVALID: "REQUEST_QUERY_INVALID",
  REQUEST_PATH_INVALID: "REQUEST_PATH_INVALID",
  REQUEST_METHOD_NOT_ALLOWED: "REQUEST_METHOD_NOT_ALLOWED",
  REQUEST_CONTENT_TYPE: "REQUEST_CONTENT_TYPE",

  // === Encryption / Security ===
  ENCRYPTION_ERROR: "ENCRYPTION_ERROR",
  ENCRYPTION_KEY_MISSING: "ENCRYPTION_KEY_MISSING",
  ENCRYPTION_DECRYPT_FAILED: "ENCRYPTION_DECRYPT_FAILED",
  ENCRYPTION_TAMPERED: "ENCRYPTION_TAMPERED",
  SECURITY_POLICY_VIOLATION: "SECURITY_POLICY_VIOLATION",
} as const;

/** Union type of all error code string values */
export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ---------------------------------------------------------------------------
// HTTP Status Code Mapping
// ---------------------------------------------------------------------------

/**
 * Maps every error code to its HTTP status code.
 *
 * Follows:
 *   - RFC 9110 (HTTP Semantics)
 *   - RFC 7807 (Problem Details for HTTP APIs)
 *   - REST conventions for resource-oriented APIs
 */
export const ERROR_CODE_STATUS_MAP: Readonly<Record<ErrorCodeType, number>> = {
  // Generic / System
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.GATEWAY_TIMEOUT]: 504,
  [ErrorCode.DEPENDENCY_FAILURE]: 502,
  [ErrorCode.UNKNOWN_ERROR]: 500,

  // Auth
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 403,
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: 403,
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 423,
  [ErrorCode.AUTH_SESSION_EXPIRED]: 401,
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ErrorCode.AUTH_TOKEN_INVALID]: 401,
  [ErrorCode.AUTH_TOKEN_MISSING]: 401,
  [ErrorCode.AUTH_TWO_FACTOR_REQUIRED]: 401,
  [ErrorCode.AUTH_TWO_FACTOR_INVALID]: 401,
  [ErrorCode.AUTH_RECOVERY_CODE_INVALID]: 401,
  [ErrorCode.AUTH_OAUTH_ERROR]: 401,
  [ErrorCode.AUTH_OAUTH_ACCOUNT_EXISTS]: 409,
  [ErrorCode.AUTH_PASSWORD_TOO_WEAK]: 422,
  [ErrorCode.AUTH_PASSWORD_REUSE]: 422,
  [ErrorCode.AUTH_UNAUTHORIZED]: 401,
  [ErrorCode.AUTH_FORBIDDEN]: 403,
  [ErrorCode.AUTH_INSUFFICIENT_ROLE]: 403,
  [ErrorCode.AUTH_INSUFFICIENT_PERMISSION]: 403,
  [ErrorCode.AUTH_CSRF_INVALID]: 403,

  // Validation
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: 422,
  [ErrorCode.VALIDATION_INVALID_FORMAT]: 422,
  [ErrorCode.VALIDATION_INVALID_EMAIL]: 422,
  [ErrorCode.VALIDATION_INVALID_URL]: 422,
  [ErrorCode.VALIDATION_MIN_LENGTH]: 422,
  [ErrorCode.VALIDATION_MAX_LENGTH]: 422,
  [ErrorCode.VALIDATION_MIN_VALUE]: 422,
  [ErrorCode.VALIDATION_MAX_VALUE]: 422,
  [ErrorCode.VALIDATION_PATTERN_MISMATCH]: 422,
  [ErrorCode.VALIDATION_UNIQUE_CONSTRAINT]: 409,
  [ErrorCode.VALIDATION_ENUM_VALUE]: 422,
  [ErrorCode.VALIDATION_TYPE_MISMATCH]: 422,
  [ErrorCode.VALIDATION_FILE_TOO_LARGE]: 413,
  [ErrorCode.VALIDATION_FILE_TYPE]: 415,
  [ErrorCode.VALIDATION_PASSWORD_MISMATCH]: 422,

  // Resource
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RESOURCE_DELETED]: 410,
  [ErrorCode.RESOURCE_LOCKED]: 423,
  [ErrorCode.RESOURCE_EXPIRED]: 410,
  [ErrorCode.RESOURCE_IMMUTABLE]: 405,
  [ErrorCode.RESOURCE_DEPENDENCY]: 424,

  // Database
  [ErrorCode.DB_ERROR]: 500,
  [ErrorCode.DB_CONNECTION]: 503,
  [ErrorCode.DB_TIMEOUT]: 504,
  [ErrorCode.DB_UNIQUE_CONSTRAINT]: 409,
  [ErrorCode.DB_FOREIGN_KEY]: 409,
  [ErrorCode.DB_NOT_NULL]: 422,
  [ErrorCode.DB_CHECK_CONSTRAINT]: 422,
  [ErrorCode.DB_MIGRATION]: 500,
  [ErrorCode.DB_TRANSACTION]: 500,

  // Rate Limit
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.RATE_LIMIT_IP]: 429,
  [ErrorCode.RATE_LIMIT_USER]: 429,
  [ErrorCode.RATE_LIMIT_API_KEY]: 429,
  [ErrorCode.RATE_LIMIT_GLOBAL]: 429,
  [ErrorCode.RATE_LIMIT_PENALTY]: 429,

  // Billing
  [ErrorCode.BILLING_ERROR]: 402,
  [ErrorCode.BILLING_INSUFFICIENT_FUNDS]: 402,
  [ErrorCode.BILLING_CARD_DECLINED]: 402,
  [ErrorCode.BILLING_CARD_EXPIRED]: 402,
  [ErrorCode.BILLING_CARD_INVALID]: 422,
  [ErrorCode.BILLING_INVALID_COUPON]: 422,
  [ErrorCode.BILLING_COUPON_EXPIRED]: 422,
  [ErrorCode.BILLING_PLAN_NOT_FOUND]: 404,
  [ErrorCode.BILLING_PLAN_INCOMPATIBLE]: 422,
  [ErrorCode.BILLING_INVOICE_NOT_FOUND]: 404,
  [ErrorCode.BILLING_SUBSCRIPTION_EXPIRED]: 402,
  [ErrorCode.BILLING_SUBSCRIPTION_CANCELLED]: 402,
  [ErrorCode.BILLING_PAYMENT_METHOD_REQUIRED]: 402,
  [ErrorCode.BILLING_TAX_CALCULATION]: 500,
  [ErrorCode.BILLING_CURRENCY_NOT_SUPPORTED]: 422,
  [ErrorCode.BILLING_PROVIDER_ERROR]: 502,
  [ErrorCode.BILLING_WEBHOOK_INVALID]: 422,

  // File
  [ErrorCode.FILE_NOT_FOUND]: 404,
  [ErrorCode.FILE_TOO_LARGE]: 413,
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: 415,
  [ErrorCode.FILE_UPLOAD_FAILED]: 500,
  [ErrorCode.FILE_DOWNLOAD_FAILED]: 500,
  [ErrorCode.FILE_STORAGE_FULL]: 507,
  [ErrorCode.FILE_MALWARE_DETECTED]: 422,
  [ErrorCode.FILE_PROCESSING_FAILED]: 500,

  // AI
  [ErrorCode.AI_PROVIDER_ERROR]: 502,
  [ErrorCode.AI_TOKEN_LIMIT]: 422,
  [ErrorCode.AI_CONTENT_FILTER]: 422,
  [ErrorCode.AI_MODEL_NOT_FOUND]: 404,
  [ErrorCode.AI_MODEL_OVERLOADED]: 503,
  [ErrorCode.AI_QUOTA_EXCEEDED]: 429,
  [ErrorCode.AI_INVALID_PROMPT]: 422,
  [ErrorCode.AI_GENERATION_FAILED]: 500,
  [ErrorCode.AI_EMBEDDING_FAILED]: 500,

  // Search
  [ErrorCode.SEARCH_INDEX_ERROR]: 500,
  [ErrorCode.SEARCH_QUERY_INVALID]: 422,
  [ErrorCode.SEARCH_INDEX_NOT_FOUND]: 404,
  [ErrorCode.SEARCH_SERVICE_UNAVAILABLE]: 503,

  // Communication
  [ErrorCode.EMAIL_SEND_FAILED]: 500,
  [ErrorCode.EMAIL_TEMPLATE_NOT_FOUND]: 404,
  [ErrorCode.EMAIL_RATE_LIMITED]: 429,
  [ErrorCode.SMS_SEND_FAILED]: 500,
  [ErrorCode.PUSH_NOTIFICATION_FAILED]: 500,
  [ErrorCode.WEBHOOK_DELIVERY_FAILED]: 502,

  // Integration
  [ErrorCode.INTEGRATION_ERROR]: 502,
  [ErrorCode.INTEGRATION_AUTH_FAILED]: 502,
  [ErrorCode.INTEGRATION_WEBHOOK_INVALID]: 422,
  [ErrorCode.INTEGRATION_RATE_LIMITED]: 429,
  [ErrorCode.INTEGRATION_CONFIG_INVALID]: 500,
  [ErrorCode.THIRD_PARTY_API_ERROR]: 502,

  // Tenant
  [ErrorCode.TENANT_NOT_FOUND]: 404,
  [ErrorCode.TENANT_DISABLED]: 403,
  [ErrorCode.TENANT_QUOTA_EXCEEDED]: 429,
  [ErrorCode.TENANT_FEATURE_DISABLED]: 403,
  [ErrorCode.TENANT_USER_LIMIT]: 422,

  // Request
  [ErrorCode.REQUEST_INVALID]: 400,
  [ErrorCode.REQUEST_BODY_TOO_LARGE]: 413,
  [ErrorCode.REQUEST_BODY_MALFORMED]: 400,
  [ErrorCode.REQUEST_HEADER_MISSING]: 400,
  [ErrorCode.REQUEST_HEADER_INVALID]: 400,
  [ErrorCode.REQUEST_QUERY_INVALID]: 400,
  [ErrorCode.REQUEST_PATH_INVALID]: 400,
  [ErrorCode.REQUEST_METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.REQUEST_CONTENT_TYPE]: 415,

  // Encryption
  [ErrorCode.ENCRYPTION_ERROR]: 500,
  [ErrorCode.ENCRYPTION_KEY_MISSING]: 500,
  [ErrorCode.ENCRYPTION_DECRYPT_FAILED]: 500,
  [ErrorCode.ENCRYPTION_TAMPERED]: 400,
  [ErrorCode.SECURITY_POLICY_VIOLATION]: 403,
} as const;

// ---------------------------------------------------------------------------
// Error Severity Levels
// ---------------------------------------------------------------------------

/** Severity level for error classification in logging and monitoring */
export type ErrorSeverity = "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Maps error codes to their severity level.
 *
 * Used by the logger to determine the appropriate log level,
 * and by monitoring to set alert thresholds.
 */
export function getErrorSeverity(code: ErrorCodeType): ErrorSeverity {
  const statusCode = ERROR_CODE_STATUS_MAP[code] ?? 500;

  if (statusCode >= 500) return "error";
  if (statusCode === 429) return "warn";
  if (statusCode >= 400 && statusCode < 500) return "info";
  return "error";
}

// ---------------------------------------------------------------------------
// Error Domain Classification
// ---------------------------------------------------------------------------

/** Error domain for grouping and aggregation */
export type ErrorDomain =
  | "system"
  | "auth"
  | "validation"
  | "resource"
  | "database"
  | "rate_limit"
  | "billing"
  | "file"
  | "ai"
  | "search"
  | "communication"
  | "integration"
  | "tenant"
  | "request"
  | "encryption";

/**
 * Extract the error domain from an error code.
 */
export function getErrorDomain(code: ErrorCodeType): ErrorDomain {
  const prefix = code.split("_")[0]?.toLowerCase() ?? "system";

  const domainMap: Record<string, ErrorDomain> = {
    internal: "system",
    not: "system",
    service: "system",
    gateway: "system",
    dependency: "system",
    unknown: "system",
    auth: "auth",
    validation: "validation",
    resource: "resource",
    db: "database",
    rate: "rate_limit",
    billing: "billing",
    file: "file",
    ai: "ai",
    search: "search",
    email: "communication",
    sms: "communication",
    push: "communication",
    webhook: "communication",
    integration: "integration",
    third: "integration",
    tenant: "tenant",
    request: "request",
    encryption: "encryption",
    security: "encryption",
  };

  return domainMap[prefix] ?? "system";
}

// ---------------------------------------------------------------------------
// i18n Message Registry
// ---------------------------------------------------------------------------

/**
 * Default English fallback messages for every error code.
 *
 * These are used when:
 *   - The i18n bundle is not yet loaded
 *   - The requested locale does not have a translation for the error code
 *   - Server-side rendering without access to the i18n context
 *
 * Translation key convention: `errors.<lowercase_error_code>`
 *   e.g., AUTH_INVALID_CREDENTIALS → errors.auth_invalid_credentials
 */
export const DEFAULT_ERROR_MESSAGES_EN: Readonly<Record<ErrorCodeType, string>> = {
  // Generic / System
  [ErrorCode.INTERNAL_SERVER_ERROR]: "An unexpected error occurred. Our team has been notified.",
  [ErrorCode.NOT_IMPLEMENTED]: "This feature is not yet implemented.",
  [ErrorCode.SERVICE_UNAVAILABLE]: "The service is temporarily unavailable. Please try again shortly.",
  [ErrorCode.GATEWAY_TIMEOUT]: "The request timed out. Please try again.",
  [ErrorCode.DEPENDENCY_FAILURE]: "A required external service is currently unreachable.",
  [ErrorCode.UNKNOWN_ERROR]: "An unknown error occurred.",

  // Auth
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: "Invalid email or password. Please check your credentials and try again.",
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: "Please verify your email address before signing in.",
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: "Your account has been disabled. Contact support for assistance.",
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: "Your account has been temporarily locked due to multiple failed attempts. Try again later.",
  [ErrorCode.AUTH_SESSION_EXPIRED]: "Your session has expired. Please sign in again.",
  [ErrorCode.AUTH_TOKEN_EXPIRED]: "The authentication token has expired. Please sign in again.",
  [ErrorCode.AUTH_TOKEN_INVALID]: "The authentication token is invalid.",
  [ErrorCode.AUTH_TOKEN_MISSING]: "Authentication token is required.",
  [ErrorCode.AUTH_TWO_FACTOR_REQUIRED]: "Two-factor authentication is required.",
  [ErrorCode.AUTH_TWO_FACTOR_INVALID]: "Invalid two-factor authentication code.",
  [ErrorCode.AUTH_RECOVERY_CODE_INVALID]: "Invalid recovery code.",
  [ErrorCode.AUTH_OAUTH_ERROR]: "OAuth authentication failed. Please try a different method.",
  [ErrorCode.AUTH_OAUTH_ACCOUNT_EXISTS]: "An account with this email already exists. Sign in with your existing account.",
  [ErrorCode.AUTH_PASSWORD_TOO_WEAK]: "Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.",
  [ErrorCode.AUTH_PASSWORD_REUSE]: "You cannot reuse a previously used password.",
  [ErrorCode.AUTH_UNAUTHORIZED]: "Authentication is required to access this resource.",
  [ErrorCode.AUTH_FORBIDDEN]: "You do not have permission to access this resource.",
  [ErrorCode.AUTH_INSUFFICIENT_ROLE]: "Your account does not have the required role for this action.",
  [ErrorCode.AUTH_INSUFFICIENT_PERMISSION]: "Your account does not have the required permissions for this action.",
  [ErrorCode.AUTH_CSRF_INVALID]: "Invalid security token. Please refresh the page and try again.",

  // Validation
  [ErrorCode.VALIDATION_ERROR]: "The provided data is invalid.",
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: "This field is required.",
  [ErrorCode.VALIDATION_INVALID_FORMAT]: "Invalid format.",
  [ErrorCode.VALIDATION_INVALID_EMAIL]: "Please enter a valid email address.",
  [ErrorCode.VALIDATION_INVALID_URL]: "Please enter a valid URL.",
  [ErrorCode.VALIDATION_MIN_LENGTH]: "Minimum {min} characters required.",
  [ErrorCode.VALIDATION_MAX_LENGTH]: "Maximum {max} characters allowed.",
  [ErrorCode.VALIDATION_MIN_VALUE]: "Value must be at least {min}.",
  [ErrorCode.VALIDATION_MAX_VALUE]: "Value must not exceed {max}.",
  [ErrorCode.VALIDATION_PATTERN_MISMATCH]: "The value does not match the required pattern.",
  [ErrorCode.VALIDATION_UNIQUE_CONSTRAINT]: "This value is already in use.",
  [ErrorCode.VALIDATION_ENUM_VALUE]: "Invalid option selected.",
  [ErrorCode.VALIDATION_TYPE_MISMATCH]: "Invalid data type.",
  [ErrorCode.VALIDATION_FILE_TOO_LARGE]: "File is too large. Maximum size is {maxSize}.",
  [ErrorCode.VALIDATION_FILE_TYPE]: "File type is not allowed. Accepted types: {allowedTypes}.",
  [ErrorCode.VALIDATION_PASSWORD_MISMATCH]: "Passwords do not match.",

  // Resource
  [ErrorCode.NOT_FOUND]: "The requested resource was not found.",
  [ErrorCode.RESOURCE_NOT_FOUND]: "The requested resource was not found.",
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: "A resource with this identifier already exists.",
  [ErrorCode.RESOURCE_CONFLICT]: "The request conflicts with the current state of the resource.",
  [ErrorCode.RESOURCE_DELETED]: "This resource has been deleted.",
  [ErrorCode.RESOURCE_LOCKED]: "This resource is locked and cannot be modified.",
  [ErrorCode.RESOURCE_EXPIRED]: "This resource has expired.",
  [ErrorCode.RESOURCE_IMMUTABLE]: "This resource cannot be modified.",
  [ErrorCode.RESOURCE_DEPENDENCY]: "This resource has dependencies that prevent this operation.",

  // Database
  [ErrorCode.DB_ERROR]: "A database error occurred.",
  [ErrorCode.DB_CONNECTION]: "Unable to connect to the database.",
  [ErrorCode.DB_TIMEOUT]: "Database operation timed out.",
  [ErrorCode.DB_UNIQUE_CONSTRAINT]: "A record with this value already exists.",
  [ErrorCode.DB_FOREIGN_KEY]: "This operation references a record that does not exist.",
  [ErrorCode.DB_NOT_NULL]: "A required database field is missing.",
  [ErrorCode.DB_CHECK_CONSTRAINT]: "The data violates a database constraint.",
  [ErrorCode.DB_MIGRATION]: "Database migration error.",
  [ErrorCode.DB_TRANSACTION]: "Database transaction failed.",

  // Rate Limit
  [ErrorCode.RATE_LIMIT_EXCEEDED]: "Too many requests. Please try again in {retryAfter} seconds.",
  [ErrorCode.RATE_LIMIT_IP]: "Too many requests from your IP address. Please try again later.",
  [ErrorCode.RATE_LIMIT_USER]: "You have made too many requests. Please slow down.",
  [ErrorCode.RATE_LIMIT_API_KEY]: "API rate limit exceeded. Upgrade your plan for higher limits.",
  [ErrorCode.RATE_LIMIT_GLOBAL]: "The service is experiencing high demand. Please try again later.",
  [ErrorCode.RATE_LIMIT_PENALTY]: "Requests are temporarily throttled due to repeated violations.",

  // Billing
  [ErrorCode.BILLING_ERROR]: "A billing error occurred.",
  [ErrorCode.BILLING_INSUFFICIENT_FUNDS]: "Insufficient funds. Please update your payment method.",
  [ErrorCode.BILLING_CARD_DECLINED]: "Your card was declined. Please try a different payment method.",
  [ErrorCode.BILLING_CARD_EXPIRED]: "Your card has expired. Please update your payment method.",
  [ErrorCode.BILLING_CARD_INVALID]: "Invalid card details. Please check and try again.",
  [ErrorCode.BILLING_INVALID_COUPON]: "The coupon code is invalid.",
  [ErrorCode.BILLING_COUPON_EXPIRED]: "The coupon code has expired.",
  [ErrorCode.BILLING_PLAN_NOT_FOUND]: "The selected plan was not found.",
  [ErrorCode.BILLING_PLAN_INCOMPATIBLE]: "The selected plan is incompatible with your current subscription.",
  [ErrorCode.BILLING_INVOICE_NOT_FOUND]: "Invoice not found.",
  [ErrorCode.BILLING_SUBSCRIPTION_EXPIRED]: "Your subscription has expired. Renew to regain access.",
  [ErrorCode.BILLING_SUBSCRIPTION_CANCELLED]: "Your subscription has been cancelled.",
  [ErrorCode.BILLING_PAYMENT_METHOD_REQUIRED]: "A payment method is required.",
  [ErrorCode.BILLING_TAX_CALCULATION]: "Tax calculation failed.",
  [ErrorCode.BILLING_CURRENCY_NOT_SUPPORTED]: "This currency is not supported.",
  [ErrorCode.BILLING_PROVIDER_ERROR]: "The payment provider encountered an error.",
  [ErrorCode.BILLING_WEBHOOK_INVALID]: "Invalid billing webhook payload.",

  // File
  [ErrorCode.FILE_NOT_FOUND]: "The requested file was not found.",
  [ErrorCode.FILE_TOO_LARGE]: "The file exceeds the maximum allowed size of {maxSize}.",
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: "This file type is not allowed.",
  [ErrorCode.FILE_UPLOAD_FAILED]: "File upload failed. Please try again.",
  [ErrorCode.FILE_DOWNLOAD_FAILED]: "File download failed.",
  [ErrorCode.FILE_STORAGE_FULL]: "Storage quota exceeded. Free up space or upgrade your plan.",
  [ErrorCode.FILE_MALWARE_DETECTED]: "The uploaded file was flagged as potentially unsafe.",
  [ErrorCode.FILE_PROCESSING_FAILED]: "File processing failed.",

  // AI
  [ErrorCode.AI_PROVIDER_ERROR]: "The AI provider encountered an error.",
  [ErrorCode.AI_TOKEN_LIMIT]: "The request exceeds the maximum token limit.",
  [ErrorCode.AI_CONTENT_FILTER]: "The content was filtered by the AI safety system.",
  [ErrorCode.AI_MODEL_NOT_FOUND]: "The requested AI model is not available.",
  [ErrorCode.AI_MODEL_OVERLOADED]: "The AI model is currently overloaded. Please try again.",
  [ErrorCode.AI_QUOTA_EXCEEDED]: "AI usage quota exceeded. Upgrade your plan for more capacity.",
  [ErrorCode.AI_INVALID_PROMPT]: "The AI prompt is invalid or malformed.",
  [ErrorCode.AI_GENERATION_FAILED]: "AI content generation failed.",
  [ErrorCode.AI_EMBEDDING_FAILED]: "AI embedding generation failed.",

  // Search
  [ErrorCode.SEARCH_INDEX_ERROR]: "Search index error.",
  [ErrorCode.SEARCH_QUERY_INVALID]: "Invalid search query.",
  [ErrorCode.SEARCH_INDEX_NOT_FOUND]: "Search index not found.",
  [ErrorCode.SEARCH_SERVICE_UNAVAILABLE]: "Search service is currently unavailable.",

  // Communication
  [ErrorCode.EMAIL_SEND_FAILED]: "Failed to send email. Please try again later.",
  [ErrorCode.EMAIL_TEMPLATE_NOT_FOUND]: "Email template not found.",
  [ErrorCode.EMAIL_RATE_LIMITED]: "Too many emails sent. Please try again later.",
  [ErrorCode.SMS_SEND_FAILED]: "Failed to send SMS. Please try again later.",
  [ErrorCode.PUSH_NOTIFICATION_FAILED]: "Failed to send push notification.",
  [ErrorCode.WEBHOOK_DELIVERY_FAILED]: "Webhook delivery failed.",

  // Integration
  [ErrorCode.INTEGRATION_ERROR]: "Integration error.",
  [ErrorCode.INTEGRATION_AUTH_FAILED]: "Integration authentication failed.",
  [ErrorCode.INTEGRATION_WEBHOOK_INVALID]: "Invalid integration webhook payload.",
  [ErrorCode.INTEGRATION_RATE_LIMITED]: "Integration rate limit exceeded.",
  [ErrorCode.INTEGRATION_CONFIG_INVALID]: "Integration configuration is invalid.",
  [ErrorCode.THIRD_PARTY_API_ERROR]: "A third-party API returned an error.",

  // Tenant
  [ErrorCode.TENANT_NOT_FOUND]: "Organization not found.",
  [ErrorCode.TENANT_DISABLED]: "This organization has been disabled.",
  [ErrorCode.TENANT_QUOTA_EXCEEDED]: "Organization quota exceeded. Upgrade your plan.",
  [ErrorCode.TENANT_FEATURE_DISABLED]: "This feature is not available on your current plan.",
  [ErrorCode.TENANT_USER_LIMIT]: "User limit reached for this organization.",

  // Request
  [ErrorCode.REQUEST_INVALID]: "The request is invalid.",
  [ErrorCode.REQUEST_BODY_TOO_LARGE]: "The request body is too large.",
  [ErrorCode.REQUEST_BODY_MALFORMED]: "The request body is malformed.",
  [ErrorCode.REQUEST_HEADER_MISSING]: "A required header is missing: {header}.",
  [ErrorCode.REQUEST_HEADER_INVALID]: "A required header is invalid: {header}.",
  [ErrorCode.REQUEST_QUERY_INVALID]: "Invalid query parameters.",
  [ErrorCode.REQUEST_PATH_INVALID]: "Invalid request path.",
  [ErrorCode.REQUEST_METHOD_NOT_ALLOWED]: "The HTTP method is not allowed for this endpoint.",
  [ErrorCode.REQUEST_CONTENT_TYPE]: "Unsupported Content-Type.",

  // Encryption
  [ErrorCode.ENCRYPTION_ERROR]: "Encryption error.",
  [ErrorCode.ENCRYPTION_KEY_MISSING]: "Encryption key is not configured.",
  [ErrorCode.ENCRYPTION_DECRYPT_FAILED]: "Failed to decrypt data.",
  [ErrorCode.ENCRYPTION_TAMPERED]: "The data appears to have been tampered with.",
  [ErrorCode.SECURITY_POLICY_VIOLATION]: "Security policy violation.",
} as const;

/**
 * Romanian (ro) fallback messages for every error code.
 */
export const DEFAULT_ERROR_MESSAGES_RO: Readonly<Record<ErrorCodeType, string>> = {
  // Generic / System
  [ErrorCode.INTERNAL_SERVER_ERROR]: "A apărut o eroare neașteptată. Echipa noastră a fost notificată.",
  [ErrorCode.NOT_IMPLEMENTED]: "Această funcționalitate nu este încă implementată.",
  [ErrorCode.SERVICE_UNAVAILABLE]: "Serviciul este temporar indisponibil. Încearcă din nou în scurt timp.",
  [ErrorCode.GATEWAY_TIMEOUT]: "Cererea a expirat. Încearcă din nou.",
  [ErrorCode.DEPENDENCY_FAILURE]: "Un serviciu extern necesar este momentan indisponibil.",
  [ErrorCode.UNKNOWN_ERROR]: "A apărut o eroare necunoscută.",

  // Auth
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: "Email sau parolă incorecte. Verifică datele și încearcă din nou.",
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: "Te rugăm să-ți verifici adresa de email înainte de autentificare.",
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: "Contul tău a fost dezactivat. Contactează suportul pentru asistență.",
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: "Contul tău a fost blocat temporar din cauza prea multor încercări. Încearcă mai târziu.",
  [ErrorCode.AUTH_SESSION_EXPIRED]: "Sesiunea a expirat. Te rugăm să te autentifici din nou.",
  [ErrorCode.AUTH_TOKEN_EXPIRED]: "Tokenul de autentificare a expirat. Te rugăm să te autentifici din nou.",
  [ErrorCode.AUTH_TOKEN_INVALID]: "Tokenul de autentificare este invalid.",
  [ErrorCode.AUTH_TOKEN_MISSING]: "Tokenul de autentificare este necesar.",
  [ErrorCode.AUTH_TWO_FACTOR_REQUIRED]: "Autentificarea în doi pași este necesară.",
  [ErrorCode.AUTH_TWO_FACTOR_INVALID]: "Codul de autentificare în doi pași este invalid.",
  [ErrorCode.AUTH_RECOVERY_CODE_INVALID]: "Codul de recuperare este invalid.",
  [ErrorCode.AUTH_OAUTH_ERROR]: "Autentificarea OAuth a eșuat. Încearcă o altă metodă.",
  [ErrorCode.AUTH_OAUTH_ACCOUNT_EXISTS]: "Există deja un cont cu acest email. Autentifică-te cu contul existent.",
  [ErrorCode.AUTH_PASSWORD_TOO_WEAK]: "Parola este prea slabă. Folosește cel puțin 8 caractere cu litere, cifre și simboluri.",
  [ErrorCode.AUTH_PASSWORD_REUSE]: "Nu poți refolosi o parolă utilizată anterior.",
  [ErrorCode.AUTH_UNAUTHORIZED]: "Autentificarea este necesară pentru a accesa această resursă.",
  [ErrorCode.AUTH_FORBIDDEN]: "Nu ai permisiunea de a accesa această resursă.",
  [ErrorCode.AUTH_INSUFFICIENT_ROLE]: "Contul tău nu are rolul necesar pentru această acțiune.",
  [ErrorCode.AUTH_INSUFFICIENT_PERMISSION]: "Contul tău nu are permisiunile necesare pentru această acțiune.",
  [ErrorCode.AUTH_CSRF_INVALID]: "Token de securitate invalid. Reîmprospătează pagina și încearcă din nou.",

  // Validation
  [ErrorCode.VALIDATION_ERROR]: "Datele furnizate sunt invalide.",
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: "Acest câmp este obligatoriu.",
  [ErrorCode.VALIDATION_INVALID_FORMAT]: "Format invalid.",
  [ErrorCode.VALIDATION_INVALID_EMAIL]: "Introdu o adresă de email validă.",
  [ErrorCode.VALIDATION_INVALID_URL]: "Introdu un URL valid.",
  [ErrorCode.VALIDATION_MIN_LENGTH]: "Minim {min} caractere necesare.",
  [ErrorCode.VALIDATION_MAX_LENGTH]: "Maxim {max} caractere permise.",
  [ErrorCode.VALIDATION_MIN_VALUE]: "Valoarea trebuie să fie cel puțin {min}.",
  [ErrorCode.VALIDATION_MAX_VALUE]: "Valoarea nu poate depăși {max}.",
  [ErrorCode.VALIDATION_PATTERN_MISMATCH]: "Valoarea nu corespunde formatului necesar.",
  [ErrorCode.VALIDATION_UNIQUE_CONSTRAINT]: "Această valoare este deja folosită.",
  [ErrorCode.VALIDATION_ENUM_VALUE]: "Opțiune invalidă selectată.",
  [ErrorCode.VALIDATION_TYPE_MISMATCH]: "Tip de date invalid.",
  [ErrorCode.VALIDATION_FILE_TOO_LARGE]: "Fișierul este prea mare. Dimensiunea maximă este {maxSize}.",
  [ErrorCode.VALIDATION_FILE_TYPE]: "Tipul de fișier nu este permis. Tipuri acceptate: {allowedTypes}.",
  [ErrorCode.VALIDATION_PASSWORD_MISMATCH]: "Parolele nu se potrivesc.",

  // Resource
  [ErrorCode.NOT_FOUND]: "Resursa solicitată nu a fost găsită.",
  [ErrorCode.RESOURCE_NOT_FOUND]: "Resursa solicitată nu a fost găsită.",
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: "Există deja o resursă cu acest identificator.",
  [ErrorCode.RESOURCE_CONFLICT]: "Cererea intră în conflict cu starea actuală a resursei.",
  [ErrorCode.RESOURCE_DELETED]: "Această resursă a fost ștearsă.",
  [ErrorCode.RESOURCE_LOCKED]: "Această resursă este blocată și nu poate fi modificată.",
  [ErrorCode.RESOURCE_EXPIRED]: "Această resursă a expirat.",
  [ErrorCode.RESOURCE_IMMUTABLE]: "Această resursă nu poate fi modificată.",
  [ErrorCode.RESOURCE_DEPENDENCY]: "Această resursă are dependențe care împiedică operația.",

  // Database
  [ErrorCode.DB_ERROR]: "A apărut o eroare de bază de date.",
  [ErrorCode.DB_CONNECTION]: "Nu se poate conecta la baza de date.",
  [ErrorCode.DB_TIMEOUT]: "Operația în baza de date a expirat.",
  [ErrorCode.DB_UNIQUE_CONSTRAINT]: "Există deja o înregistrare cu această valoare.",
  [ErrorCode.DB_FOREIGN_KEY]: "Această operație face referire la o înregistrare care nu există.",
  [ErrorCode.DB_NOT_NULL]: "Un câmp obligatoriu din baza de date lipsește.",
  [ErrorCode.DB_CHECK_CONSTRAINT]: "Datele încalcă o constrângere a bazei de date.",
  [ErrorCode.DB_MIGRATION]: "Eroare la migrarea bazei de date.",
  [ErrorCode.DB_TRANSACTION]: "Tranzacția bazei de date a eșuat.",

  // Rate Limit
  [ErrorCode.RATE_LIMIT_EXCEEDED]: "Prea multe cereri. Încearcă din nou în {retryAfter} secunde.",
  [ErrorCode.RATE_LIMIT_IP]: "Prea multe cereri de la adresa ta IP. Încearcă mai târziu.",
  [ErrorCode.RATE_LIMIT_USER]: "Ai făcut prea multe cereri. Reduce viteza.",
  [ErrorCode.RATE_LIMIT_API_KEY]: "Limita de rată API a fost depășită. Actualizează planul pentru limite mai mari.",
  [ErrorCode.RATE_LIMIT_GLOBAL]: "Serviciul se confruntă cu cerere ridicată. Încearcă mai târziu.",
  [ErrorCode.RATE_LIMIT_PENALTY]: "Cererile sunt temporar limitate din cauza încălcărilor repetate.",

  // Billing
  [ErrorCode.BILLING_ERROR]: "A apărut o eroare de facturare.",
  [ErrorCode.BILLING_INSUFFICIENT_FUNDS]: "Fonduri insuficiente. Actualizează metoda de plată.",
  [ErrorCode.BILLING_CARD_DECLINED]: "Cardul a fost respins. Încearcă o altă metodă de plată.",
  [ErrorCode.BILLING_CARD_EXPIRED]: "Cardul a expirat. Actualizează metoda de plată.",
  [ErrorCode.BILLING_CARD_INVALID]: "Detalii card invalide. Verifică și încearcă din nou.",
  [ErrorCode.BILLING_INVALID_COUPON]: "Codul promoțional este invalid.",
  [ErrorCode.BILLING_COUPON_EXPIRED]: "Codul promoțional a expirat.",
  [ErrorCode.BILLING_PLAN_NOT_FOUND]: "Planul selectat nu a fost găsit.",
  [ErrorCode.BILLING_PLAN_INCOMPATIBLE]: "Planul selectat este incompatibil cu abonamentul curent.",
  [ErrorCode.BILLING_INVOICE_NOT_FOUND]: "Factura nu a fost găsită.",
  [ErrorCode.BILLING_SUBSCRIPTION_EXPIRED]: "Abonamentul a expirat. Reînnoiește pentru a recâștiga accesul.",
  [ErrorCode.BILLING_SUBSCRIPTION_CANCELLED]: "Abonamentul a fost anulat.",
  [ErrorCode.BILLING_PAYMENT_METHOD_REQUIRED]: "Este necesară o metodă de plată.",
  [ErrorCode.BILLING_TAX_CALCULATION]: "Calculul taxelor a eșuat.",
  [ErrorCode.BILLING_CURRENCY_NOT_SUPPORTED]: "Această monedă nu este suportată.",
  [ErrorCode.BILLING_PROVIDER_ERROR]: "Furnizorul de plăți a întâmpinat o eroare.",
  [ErrorCode.BILLING_WEBHOOK_INVALID]: "Payload webhook de facturare invalid.",

  // File
  [ErrorCode.FILE_NOT_FOUND]: "Fișierul solicitat nu a fost găsit.",
  [ErrorCode.FILE_TOO_LARGE]: "Fișierul depășește dimensiunea maximă permisă de {maxSize}.",
  [ErrorCode.FILE_TYPE_NOT_ALLOWED]: "Acest tip de fișier nu este permis.",
  [ErrorCode.FILE_UPLOAD_FAILED]: "Încărcarea fișierului a eșuat. Încearcă din nou.",
  [ErrorCode.FILE_DOWNLOAD_FAILED]: "Descărcarea fișierului a eșuat.",
  [ErrorCode.FILE_STORAGE_FULL]: "Spațiul de stocare a fost depășit. Eliberează spațiu sau actualizează planul.",
  [ErrorCode.FILE_MALWARE_DETECTED]: "Fișierul încărcat a fost semnalat ca potențial nesigur.",
  [ErrorCode.FILE_PROCESSING_FAILED]: "Procesarea fișierului a eșuat.",

  // AI
  [ErrorCode.AI_PROVIDER_ERROR]: "Furnizorul AI a întâmpinat o eroare.",
  [ErrorCode.AI_TOKEN_LIMIT]: "Cererea depășește limita maximă de tokenuri.",
  [ErrorCode.AI_CONTENT_FILTER]: "Conținutul a fost filtrat de sistemul de siguranță AI.",
  [ErrorCode.AI_MODEL_NOT_FOUND]: "Modelul AI solicitat nu este disponibil.",
  [ErrorCode.AI_MODEL_OVERLOADED]: "Modelul AI este supraîncărcat momentan. Încearcă din nou.",
  [ErrorCode.AI_QUOTA_EXCEEDED]: "Cota de utilizare AI a fost depășită. Actualizează planul pentru mai multă capacitate.",
  [ErrorCode.AI_INVALID_PROMPT]: "Promptul AI este invalid sau malformat.",
  [ErrorCode.AI_GENERATION_FAILED]: "Generarea de conținut AI a eșuat.",
  [ErrorCode.AI_EMBEDDING_FAILED]: "Generarea de embeddings AI a eșuat.",

  // Search
  [ErrorCode.SEARCH_INDEX_ERROR]: "Eroare la indexul de căutare.",
  [ErrorCode.SEARCH_QUERY_INVALID]: "Interogare de căutare invalidă.",
  [ErrorCode.SEARCH_INDEX_NOT_FOUND]: "Indexul de căutare nu a fost găsit.",
  [ErrorCode.SEARCH_SERVICE_UNAVAILABLE]: "Serviciul de căutare este momentan indisponibil.",

  // Communication
  [ErrorCode.EMAIL_SEND_FAILED]: "Trimiterea emailului a eșuat. Încearcă din nou mai târziu.",
  [ErrorCode.EMAIL_TEMPLATE_NOT_FOUND]: "Șablonul de email nu a fost găsit.",
  [ErrorCode.EMAIL_RATE_LIMITED]: "Prea multe emailuri trimise. Încearcă din nou mai târziu.",
  [ErrorCode.SMS_SEND_FAILED]: "Trimiterea SMS-ului a eșuat. Încearcă din nou mai târziu.",
  [ErrorCode.PUSH_NOTIFICATION_FAILED]: "Trimiterea notificării push a eșuat.",
  [ErrorCode.WEBHOOK_DELIVERY_FAILED]: "Livrarea webhook-ului a eșuat.",

  // Integration
  [ErrorCode.INTEGRATION_ERROR]: "Eroare de integrare.",
  [ErrorCode.INTEGRATION_AUTH_FAILED]: "Autentificarea integrării a eșuat.",
  [ErrorCode.INTEGRATION_WEBHOOK_INVALID]: "Payload webhook de integrare invalid.",
  [ErrorCode.INTEGRATION_RATE_LIMITED]: "Limita de rată a integrării a fost depășită.",
  [ErrorCode.INTEGRATION_CONFIG_INVALID]: "Configurația integrării este invalidă.",
  [ErrorCode.THIRD_PARTY_API_ERROR]: "Un API terț a returnat o eroare.",

  // Tenant
  [ErrorCode.TENANT_NOT_FOUND]: "Organizația nu a fost găsită.",
  [ErrorCode.TENANT_DISABLED]: "Această organizație a fost dezactivată.",
  [ErrorCode.TENANT_QUOTA_EXCEEDED]: "Cota organizației a fost depășită. Actualizează planul.",
  [ErrorCode.TENANT_FEATURE_DISABLED]: "Această funcționalitate nu este disponibilă în planul curent.",
  [ErrorCode.TENANT_USER_LIMIT]: "Limita de utilizatori a fost atinsă pentru această organizație.",

  // Request
  [ErrorCode.REQUEST_INVALID]: "Cererea este invalidă.",
  [ErrorCode.REQUEST_BODY_TOO_LARGE]: "Corpul cererii este prea mare.",
  [ErrorCode.REQUEST_BODY_MALFORMED]: "Corpul cererii este malformat.",
  [ErrorCode.REQUEST_HEADER_MISSING]: "Un antet necesar lipsește: {header}.",
  [ErrorCode.REQUEST_HEADER_INVALID]: "Un antet necesar este invalid: {header}.",
  [ErrorCode.REQUEST_QUERY_INVALID]: "Parametrii de interogare sunt invalizi.",
  [ErrorCode.REQUEST_PATH_INVALID]: "Calea cererii este invalidă.",
  [ErrorCode.REQUEST_METHOD_NOT_ALLOWED]: "Metoda HTTP nu este permisă pentru acest endpoint.",
  [ErrorCode.REQUEST_CONTENT_TYPE]: "Content-Type nesuportat.",

  // Encryption
  [ErrorCode.ENCRYPTION_ERROR]: "Eroare de criptare.",
  [ErrorCode.ENCRYPTION_KEY_MISSING]: "Cheia de criptare nu este configurată.",
  [ErrorCode.ENCRYPTION_DECRYPT_FAILED]: "Decriptarea datelor a eșuat.",
  [ErrorCode.ENCRYPTION_TAMPERED]: "Datele par să fi fost modificate.",
  [ErrorCode.SECURITY_POLICY_VIOLATION]: "Încălcare a politicii de securitate.",
} as const;

/**
 * Lookup the default message for an error code in the given locale.
 * Falls back to English if the locale is not supported.
 */
export function getDefaultErrorMessage(
  code: ErrorCodeType,
  locale: string = "en",
): string {
  if (locale === "ro") {
    return (
      DEFAULT_ERROR_MESSAGES_RO[code] ??
      DEFAULT_ERROR_MESSAGES_EN[code] ??
      "An unexpected error occurred."
    );
  }
  return (
    DEFAULT_ERROR_MESSAGES_EN[code] ?? "An unexpected error occurred."
  );
}

/**
 * Derive the i18n translation key from an error code.
 *
 * Convention: `errors.<lowercase_code>`
 *   e.g., AUTH_INVALID_CREDENTIALS → "errors.auth_invalid_credentials"
 */
export function getErrorCodeI18nKey(code: ErrorCodeType): string {
  return `errors.${code.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// AppError Class
// ---------------------------------------------------------------------------

/**
 * Structured application error with error code, status code, i18n support,
 * cause chaining, and metadata.
 *
 * Always throw AppError instead of raw Error for any expected error condition.
 * This ensures consistent error responses, proper i18n, and clean logging.
 *
 * @example
 *   throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, {
 *     message: "Email or password is incorrect",
 *     cause: originalError,
 *     metadata: { email: userEmail },
 *   });
 *
 * @example
 *   throw new AppError(ErrorCode.VALIDATION_REQUIRED_FIELD, {
 *     message: "Name is required",
 *     i18nParams: { field: "name" },
 *     details: [{ field: "name", rule: "required" }],
 *   });
 */
export class AppError extends Error {
  /** Machine-readable error code */
  public readonly code: ErrorCodeType;

  /** HTTP status code derived from the error code */
  public readonly statusCode: number;

  /** Error domain (system, auth, validation, etc.) */
  public readonly domain: ErrorDomain;

  /** Severity level for logging/monitoring */
  public readonly severity: ErrorSeverity;

  /** i18n translation key for the error message */
  public readonly i18nKey: string;

  /** Parameters for i18n interpolation (e.g., { min: 8 }) */
  public readonly i18nParams: Record<string, string | number> | undefined;

  /** Additional structured details about the error */
  public readonly details: unknown | undefined;

  /** Arbitrary metadata for diagnostics */
  public readonly metadata: Record<string, unknown> | undefined;

  /** Whether the error stack trace is safe to expose in responses */
  public readonly exposeStack: boolean;

  /** Timestamp when the error was created */
  public readonly timestamp: string;

  /** Unique error instance ID for tracing */
  public readonly errorId: string;

  /** The underlying cause (if this error wraps another) */
  public override readonly cause: Error | undefined;

  constructor(
    code: ErrorCodeType,
    opts: AppErrorOptions = {},
  ) {
    const statusCode = opts.statusCode ?? ERROR_CODE_STATUS_MAP[code] ?? 500;
    const message = opts.message ?? getDefaultErrorMessage(code, "en");
    super(message);

    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.domain = opts.domain ?? getErrorDomain(code);
    this.severity = opts.severity ?? getErrorSeverity(code);
    this.i18nKey = opts.i18nKey ?? getErrorCodeI18nKey(code);
    this.i18nParams = opts.i18nParams;
    this.details = opts.details;
    this.metadata = opts.metadata;
    this.exposeStack = opts.exposeStack ?? (process.env.NODE_ENV !== "production");
    this.timestamp = new Date().toISOString();
    this.errorId = opts.errorId ?? generateErrorId();
    this.cause = opts.cause;

    // Capture stack trace, excluding this constructor frame
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Return a safe JSON-serializable representation of the error.
   * Never exposes the raw stack trace unless `exposeStack` is true.
   */
  toJSON(): SerializedError {
    return serializeError(this);
  }

  /**
   * Get the user-facing message for a given locale.
   * Falls back to the error's message if locale is not provided.
   */
  getUserMessage(locale?: string): string {
    if (!locale) return this.message;
    return getDefaultErrorMessage(this.code, locale);
  }

  /**
   * Check if this error has a specific error code.
   */
  hasCode(code: ErrorCodeType): boolean {
    return this.code === code;
  }

  /**
   * Check if this error belongs to a specific domain.
   */
  isDomain(domain: ErrorDomain): boolean {
    return this.domain === domain;
  }
}

/** Options for constructing an AppError */
export interface AppErrorOptions {
  /** Override the default message (useful for dynamic messages) */
  message?: string;
  /** Override the HTTP status code (derived from error code by default) */
  statusCode?: number;
  /** Override the error domain */
  domain?: ErrorDomain;
  /** Override the severity level */
  severity?: ErrorSeverity;
  /** Override the i18n translation key */
  i18nKey?: string;
  /** Parameters for i18n interpolation */
  i18nParams?: Record<string, string | number>;
  /** Structured error details (e.g., validation errors array) */
  details?: unknown;
  /** Arbitrary metadata for diagnostics */
  metadata?: Record<string, unknown>;
  /** Whether to include stack trace in serialized output */
  exposeStack?: boolean;
  /** Custom error instance ID for tracing */
  errorId?: string;
  /** The underlying cause (wrapping another error) */
  cause?: Error;
}

// ---------------------------------------------------------------------------
// Serialized Error Shape
// ---------------------------------------------------------------------------

/** The JSON-safe representation of an error returned by the API */
export interface SerializedError {
  /** Machine-readable error code */
  code: ErrorCodeType;
  /** Human-readable message in the requested locale */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Error domain for grouping */
  domain: ErrorDomain;
  /** i18n key for client-side translation */
  i18nKey: string;
  /** i18n interpolation parameters */
  i18nParams?: Record<string, string | number>;
  /** Structured error details (e.g., validation errors) */
  details?: unknown;
  /** Unique error instance ID for tracing */
  errorId: string;
  /** ISO timestamp */
  timestamp: string;
  /** Sanitized stack trace (only in development or when exposeStack is true) */
  stack?: string;
}

// ---------------------------------------------------------------------------
// Built Error Response Shape
// ---------------------------------------------------------------------------

/** Full error response body returned to the client */
export interface ErrorResponseBody {
  success: false;
  error: SerializedError;
  requestId?: string;
  path?: string;
  method?: string;
}

/** Complete error response with body and status */
export interface ErrorResponse {
  body: ErrorResponseBody;
  status: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envStr(key: string, fallback: string): string {
  const raw = process.env[key];
  return raw !== undefined && raw !== "" ? raw : fallback;
}

export interface ErrorHandlerConfig {
  exposeStack: boolean;
  maxTraceDepth: number;
  stripBasePath: string;
  defaultLocale: string;
}

function buildConfig(): ErrorHandlerConfig {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    exposeStack: envBool("ERROR_HANDLER_EXPOSE_STACK", !isProduction),
    maxTraceDepth: envInt("ERROR_HANDLER_MAX_TRACE_DEPTH", 20),
    stripBasePath: envStr("ERROR_HANDLER_STRIP_BASE_PATH", process.cwd()),
    defaultLocale: envStr("ERROR_HANDLER_DEFAULT_LOCALE", "en"),
  };
}

let _config: ErrorHandlerConfig | undefined;

function getConfig(): ErrorHandlerConfig {
  if (!_config) {
    _config = buildConfig();
  }
  return _config;
}

/** Reload configuration at runtime */
export function reloadErrorHandlerConfig(): ErrorHandlerConfig {
  _config = buildConfig();
  return _config;
}

// ---------------------------------------------------------------------------
// Error ID Generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique error instance ID for tracing.
 * Format: err_<timestamp>_<random>
 */
function generateErrorId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `err_${ts}_${rand}`;
}

// ---------------------------------------------------------------------------
// Stack Trace Sanitization
// ---------------------------------------------------------------------------

/**
 * Sensitive path patterns to filter from stack traces.
 * Prevents leaking of local filesystem paths, usernames, and secrets.
 */
const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  // Windows user directories
  /C:\\Users\\[^\\]+/gi,
  // Unix home directories
  /\/home\/[^/]+/gi,
  /\/Users\/[^/]+/gi,
  // Environment variables in paths
  /\$\{[^}]+\}/g,
  // API keys / tokens in query strings (file:// urls etc.)
  /[?&](api_key|apikey|token|secret|password|key)=[^&\s]+/gi,
  /[?&](api_key|apikey|token|secret|password|key)=/gi,
  // bearer tokens in paths
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  // AWS-style keys
  /AKIA[0-9A-Z]{16}/g,
];

/**
 * Sanitize a full stack trace string by:
 *   1. Removing sensitive paths (usernames, tokens, secrets)
 *   2. Stripping the project base path to relative paths
 *   3. Normalizing node_modules / node:internal frames
 *   4. Limiting the number of frames
 *   5. Truncating individual frame lines
 *
 * @param stack - The raw Error.stack string
 * @param maxDepth - Maximum number of frames to include
 * @returns Sanitized stack trace string
 */
export function sanitizeStackTrace(
  stack: string,
  maxDepth?: number,
): string {
  if (!stack) return "";

  const config = getConfig();
  const depth = maxDepth ?? config.maxTraceDepth;
  const basePath = config.stripBasePath;

  let sanitized = stack;

  // 1. Redact sensitive path patterns
  for (const pattern of SENSITIVE_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  // 2. Strip the base path to make paths relative
  if (basePath) {
    // Normalize Windows backslashes for regex
    const normalizedBase = basePath.replace(/\\/g, "/");
    sanitized = sanitized.replace(
      new RegExp(normalizedBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/?", "g"),
      "",
    );
  }

  // 3. Normalize node_modules frames
  sanitized = sanitized.replace(
    /\/?(node_modules\/[^:)]+):(\d+):(\d+)/g,
    (_, mod, line, col) => `node_modules/${stripVersionedModule(mod)}:${line}:${col}`,
  );

  // 4. Normalize node:internal frames — group them
  sanitized = sanitized.replace(
    /at\s+.+\s+\(?(node:internal\/[^:)]+)\)?/g,
    "at [node:internal]",
  );

  // 5. Limit to maxDepth frames
  const lines = sanitized.split("\n");
  const header = lines.slice(0, 1); // Keep the error message line
  const frames = lines.slice(1).filter((line) => line.trim());

  const limitedFrames = frames.slice(0, depth);
  if (frames.length > depth) {
    limitedFrames.push(
      `  ... and ${frames.length - depth} more frame(s) [truncated]`,
    );
  }

  return [...header, ...limitedFrames].join("\n");
}

/**
 * Strip versioning info from module paths.
 * E.g., "lodash@4.17.21/index.js" → "lodash/index.js"
 */
function stripVersionedModule(modulePath: string): string {
  return modulePath.replace(/@[\d.]+/, "");
}

/**
 * Extract a sanitized, safe stack trace from an Error object.
 *
 * This is the preferred way to get a stack trace for logging or
 * API responses — it handles both AppError and native Error objects.
 *
 * @param err - The error object
 * @param maxDepth - Maximum frames to include
 * @returns Sanitized stack trace or empty string if no stack available
 */
export function getSafeStackTrace(
  err: unknown,
  maxDepth?: number,
): string {
  if (!(err instanceof Error) || !err.stack) return "";
  return sanitizeStackTrace(err.stack, maxDepth);
}

/**
 * Create a concise stack trace summary (first meaningful frame only).
 * Useful for log lines where full stack is too verbose.
 */
export function getStackSummary(err: unknown): string {
  if (!(err instanceof Error) || !err.stack) return "";

  const lines = err.stack.split("\n");
  // Skip the error message (line 0), find first non-internal frame
  for (let i = 1; i < lines.length; i++) {
    const frame = lines[i]?.trim();
    if (
      frame &&
      !frame.includes("node:internal") &&
      !frame.includes("node_modules")
    ) {
      return frame.replace(/^at\s+/, "");
    }
  }

  // Fallback to the first frame
  return lines[1]?.trim().replace(/^at\s+/, "") ?? "";
}

// ---------------------------------------------------------------------------
// Error Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize an error to a safe JSON representation for API responses.
 *
 * Handles:
 *   - AppError — full structured serialization
 *   - Native Error — minimal serialization with generic code
 *   - Non-Error thrown values — stringified representation
 *
 * Never leaks raw stack traces in production unless `exposeStack` is true.
 *
 * @param err - The error (or thrown value) to serialize
 * @param locale - Locale for the user-facing message
 * @returns SerializedError safe for JSON response
 */
export function serializeError(
  err: unknown,
  locale?: string,
): SerializedError {
  const config = getConfig();

  // Already an AppError — full structured serialization
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: locale
        ? err.getUserMessage(locale)
        : err.message,
      statusCode: err.statusCode,
      domain: err.domain,
      i18nKey: err.i18nKey,
      i18nParams: err.i18nParams,
      details: err.details,
      errorId: err.errorId,
      timestamp: err.timestamp,
      stack: err.exposeStack && err.stack
        ? sanitizeStackTrace(err.stack)
        : undefined,
    };
  }

  // Native Error — minimal structured serialization
  if (err instanceof Error) {
    const isProduction = process.env.NODE_ENV === "production";
    return {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: isProduction
        ? getDefaultErrorMessage(ErrorCode.INTERNAL_SERVER_ERROR, locale ?? config.defaultLocale)
        : err.message,
      statusCode: 500,
      domain: "system",
      i18nKey: getErrorCodeI18nKey(ErrorCode.INTERNAL_SERVER_ERROR),
      errorId: generateErrorId(),
      timestamp: new Date().toISOString(),
      stack: config.exposeStack && err.stack
        ? sanitizeStackTrace(err.stack)
        : undefined,
    };
  }

  // Non-Error thrown value
  const message =
    typeof err === "string"
      ? err
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: unknown }).message)
        : "An unexpected error occurred.";

  return {
    code: ErrorCode.INTERNAL_SERVER_ERROR,
    message,
    statusCode: 500,
    domain: "system",
    i18nKey: getErrorCodeI18nKey(ErrorCode.INTERNAL_SERVER_ERROR),
    errorId: generateErrorId(),
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Error Response Builder
// ---------------------------------------------------------------------------

/**
 * Build a complete error response from any thrown value.
 *
 * This is the primary function for converting errors into API responses.
 * It handles AppError, native Error, and non-Error values uniformly.
 *
 * @param err - The error or thrown value
 * @param ctx - Optional request context for enrichment
 * @returns ErrorResponse with body and status code
 *
 * @example
 *   try {
 *     await processRequest();
 *   } catch (err) {
 *     const { body, status } = buildErrorResponse(err, {
 *       requestId: "req_abc123",
 *       path: "/api/users",
 *       method: "POST",
 *       locale: "ro",
 *     });
 *     return NextResponse.json(body, { status });
 *   }
 */
export function buildErrorResponse(
  err: unknown,
  ctx?: {
    requestId?: string;
    path?: string;
    method?: string;
    locale?: string;
  },
): ErrorResponse {
  const serialized = serializeError(err, ctx?.locale);

  const body: ErrorResponseBody = {
    success: false,
    error: serialized,
    requestId: ctx?.requestId,
    path: ctx?.path,
    method: ctx?.method,
  };

  return {
    body,
    status: serialized.statusCode,
  };
}

// ---------------------------------------------------------------------------
// Validation Error Builder
// ---------------------------------------------------------------------------

/**
 * Structure for a single validation error detail.
 */
export interface ValidationErrorDetail {
  field: string;
  code: ErrorCodeType;
  message: string;
  params?: Record<string, string | number>;
}

/**
 * Build a validation error with detailed field-level errors.
 *
 * @param details - Array of field-level validation errors
 * @param opts - Additional AppError options
 * @returns AppError ready to throw or return
 *
 * @example
 *   throw buildValidationError([
 *     { field: "email", code: ErrorCode.VALIDATION_INVALID_EMAIL, message: "Invalid email" },
 *     { field: "password", code: ErrorCode.VALIDATION_MIN_LENGTH, message: "Too short", params: { min: 8 } },
 *   ]);
 */
export function buildValidationError(
  details: ValidationErrorDetail[],
  opts?: AppErrorOptions,
): AppError {
  return new AppError(ErrorCode.VALIDATION_ERROR, {
    message: "Validation failed. Check the details for more information.",
    statusCode: 422,
    details,
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// Prisma Error Parser
// ---------------------------------------------------------------------------

/**
 * Parse Prisma client known request errors into AppError instances.
 *
 * Maps common Prisma error codes to appropriate application error codes:
 *   P2002 → DB_UNIQUE_CONSTRAINT (409)
 *   P2003 → DB_FOREIGN_KEY (409)
 *   P2011 → DB_NOT_NULL (422)
 *   P2025 → NOT_FOUND (404)
 *   etc.
 *
 * @param err - The error thrown by Prisma
 * @returns AppError if recognized, or undefined if it's not a Prisma error
 *
 * @example
 *   try {
 *     await prisma.user.create({ data });
 *   } catch (err) {
 *     const appErr = parsePrismaError(err);
 *     if (appErr) throw appErr;
 *     throw err;
 *   }
 */
export function parsePrismaError(err: unknown): AppError | undefined {
  if (!isPrismaError(err)) return undefined;

  const prismaErr = err as PrismaClientKnownError;
  const code = prismaErr.code;
  const meta = prismaErr.meta as Record<string, unknown> | undefined;

  switch (code) {
    case "P2002": {
      const target = (meta?.target as string[])?.join(", ") ?? "unknown";
      return new AppError(ErrorCode.DB_UNIQUE_CONSTRAINT, {
        message: `A record with the same ${target} already exists.`,
        details: { target, meta },
        cause: err as Error,
      });
    }

    case "P2003":
      return new AppError(ErrorCode.DB_FOREIGN_KEY, {
        message: "Related record not found.",
        details: { meta },
        cause: err as Error,
      });

    case "P2004":
      return new AppError(ErrorCode.DB_CHECK_CONSTRAINT, {
        message: "A database constraint was violated.",
        details: { meta },
        cause: err as Error,
      });

    case "P2011":
      return new AppError(ErrorCode.DB_NOT_NULL, {
        message: `Required field is missing: ${(meta?.target as string[] | undefined)?.join(", ") ?? "unknown"}.`,
        details: { meta },
        cause: err as Error,
      });

    case "P2014":
      return new AppError(ErrorCode.RESOURCE_DEPENDENCY, {
        message: "Cannot delete this record because other records depend on it.",
        details: { meta },
        cause: err as Error,
      });

    case "P2025":
      return new AppError(ErrorCode.NOT_FOUND, {
        message: "The requested record was not found.",
        details: { meta },
        cause: err as Error,
      });

    case "P2024":
      return new AppError(ErrorCode.DB_TIMEOUT, {
        message: "Database operation timed out.",
        cause: err as Error,
      });

    case "P2034":
      return new AppError(ErrorCode.DB_TRANSACTION, {
        message: "Database transaction failed. Please retry.",
        cause: err as Error,
      });

    default:
      // Unknown Prisma error — wrap generically
      return new AppError(ErrorCode.DB_ERROR, {
        message: prismaErr.message,
        details: { prismaCode: code, meta },
        cause: err as Error,
      });
  }
}

/**
 * Type for Prisma client known request errors.
 * (Prisma doesn't expose this type directly, so we define a minimal interface.)
 */
interface PrismaClientKnownError extends Error {
  code: string;
  meta?: Record<string, unknown>;
  clientVersion: string;
}

/**
 * Check if an error is a Prisma client known request error.
 */
function isPrismaError(err: unknown): err is PrismaClientKnownError {
  return (
    err instanceof Error &&
    "code" in err &&
    typeof (err as PrismaClientKnownError).code === "string" &&
    (err as PrismaClientKnownError).code.startsWith("P") &&
    "clientVersion" in err
  );
}

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Type guard: check if a value is an AppError instance.
 *
 * More robust than `instanceof AppError` because it survives
 * serialization boundaries and multiple module instances.
 *
 * @example
 *   try {
 *     await riskyOperation();
 *   } catch (err) {
 *     if (isAppError(err)) {
 *       return buildErrorResponse(err);
 *     }
 *     // Handle unknown errors
 *   }
 */
export function isAppError(err: unknown): err is AppError {
  return (
    err instanceof AppError ||
    (
      err instanceof Error &&
      "code" in err &&
      typeof (err as AppError).code === "string" &&
      "statusCode" in err &&
      typeof (err as AppError).statusCode === "number" &&
      "i18nKey" in err
    )
  );
}

/**
 * Type guard: check if a value is a known/structured error (AppError or PrismaError).
 * "Known" means we have structured information about the error.
 */
export function isKnownError(err: unknown): boolean {
  return isAppError(err) || isPrismaError(err);
}

/**
 * Extract the HTTP status code from any error.
 * Returns 500 for unknown errors.
 */
export function getErrorStatusCode(err: unknown): number {
  if (isAppError(err)) return err.statusCode;
  if (err instanceof Error && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  if (err instanceof Error && "status" in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === "number") return s;
  }
  return 500;
}

/**
 * Extract a safe message from any error.
 */
export function getErrorMessage(err: unknown, locale?: string): string {
  if (isAppError(err)) {
    return locale ? err.getUserMessage(locale) : err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") return err;
  return getDefaultErrorMessage(
    ErrorCode.INTERNAL_SERVER_ERROR,
    locale ?? getConfig().defaultLocale,
  );
}

// ---------------------------------------------------------------------------
// Error Handling Wrapper
// ---------------------------------------------------------------------------

/**
 * Options for the `handleError` function.
 */
export interface HandleErrorOptions {
  /** Request ID for tracing */
  requestId?: string;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Locale for the user-facing error message */
  locale?: string;
  /** Custom logger (uses console.error by default) */
  logger?: {
    error: (msg: string, obj?: Record<string, unknown>) => void;
    warn: (msg: string, obj?: Record<string, unknown>) => void;
    info: (msg: string, obj?: Record<string, unknown>) => void;
  };
  /** Additional context to include in the error log */
  logContext?: Record<string, unknown>;
  /** Throw instead of returning an error response (for re-throw patterns) */
  rethrow?: boolean;
}

/**
 * Unified error handler — log the error and build an HTTP response.
 *
 * This is the recommended way to handle errors in API routes and server actions.
 * It logs the error appropriately (warn for 4xx, error for 5xx) and returns
 * a consistent ErrorResponse.
 *
 * @param err - The error to handle
 * @param opts - Options for logging and response building
 * @returns ErrorResponse ready to be returned from an API route
 *
 * @example
 *   export async function GET(req: NextRequest) {
 *     try {
 *       const data = await fetchData();
 *       return NextResponse.json({ success: true, data });
 *     } catch (err) {
 *       const { body, status } = await handleError(err, {
 *         requestId: req.headers.get("x-request-id") ?? undefined,
 *         path: req.nextUrl.pathname,
 *         method: "GET",
 *       });
 *       return NextResponse.json(body, { status });
 *     }
 *   }
 */
export function handleError(
  err: unknown,
  opts: HandleErrorOptions = {},
): ErrorResponse {
  // Try to parse Prisma errors into AppError
  if (!isAppError(err) && isPrismaError(err)) {
    const parsed = parsePrismaError(err);
    if (parsed) {
      err = parsed;
    }
  }

  const serialized = serializeError(err, opts.locale);
  const severity = isAppError(err) ? err.severity : getErrorSeverity(ErrorCode.INTERNAL_SERVER_ERROR);

  // Log the error
  const log = opts.logger ?? {
    error: (msg: string, obj?: Record<string, unknown>) => {
      console.error(msg, obj ?? "");
    },
    warn: (msg: string, obj?: Record<string, unknown>) => {
      console.warn(msg, obj ?? "");
    },
    info: (msg: string, obj?: Record<string, unknown>) => {
      console.info(msg, obj ?? "");
    },
  };

  const logPayload: Record<string, unknown> = {
    errorCode: serialized.code,
    errorId: serialized.errorId,
    statusCode: serialized.statusCode,
    domain: serialized.domain,
    requestId: opts.requestId,
    path: opts.path,
    method: opts.method,
    stackSummary: getStackSummary(err),
    ...opts.logContext,
  };

  if (isAppError(err) && err.metadata) {
    logPayload.metadata = err.metadata;
  }

  if (severity === "fatal" || severity === "error") {
    log.error(`[${serialized.code}] ${serialized.message}`, logPayload);
  } else if (severity === "warn") {
    log.warn(`[${serialized.code}] ${serialized.message}`, logPayload);
  } else {
    log.info(`[${serialized.code}] ${serialized.message}`, logPayload);
  }

  // Rethrow if requested
  if (opts.rethrow) {
    if (err instanceof Error) throw err;
    throw new AppError(ErrorCode.INTERNAL_SERVER_ERROR, {
      message: String(err),
    });
  }

  // Build response
  return buildErrorResponse(err, {
    requestId: opts.requestId,
    path: opts.path,
    method: opts.method,
    locale: opts.locale,
  });
}

// ---------------------------------------------------------------------------
// Retry Information
// ---------------------------------------------------------------------------

/**
 * Determine whether an error is retryable.
 *
 * Retryable errors include:
 *   - Network timeouts (504)
 *   - Service unavailable (503)
 *   - Rate limit exceeded (429)
 *   - Database timeouts
 *   - AI model overloaded
 *
 * @param err - The error to check
 * @returns true if the operation can be safely retried
 */
export function isRetryable(err: unknown): boolean {
  const statusCode = getErrorStatusCode(err);

  // Status codes that are generally safe to retry
  if ([429, 503, 504].includes(statusCode)) return true;

  // Specific error codes that are retryable
  if (isAppError(err)) {
    const retryableCodes: ErrorCodeType[] = [
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.RATE_LIMIT_IP,
      ErrorCode.RATE_LIMIT_USER,
      ErrorCode.RATE_LIMIT_API_KEY,
      ErrorCode.RATE_LIMIT_GLOBAL,
      ErrorCode.SERVICE_UNAVAILABLE,
      ErrorCode.GATEWAY_TIMEOUT,
      ErrorCode.DB_TIMEOUT,
      ErrorCode.DB_TRANSACTION,
      ErrorCode.AI_MODEL_OVERLOADED,
      ErrorCode.DEPENDENCY_FAILURE,
    ];
    return retryableCodes.includes(err.code);
  }

  return false;
}

/**
 * Get the recommended retry delay in seconds for a given error.
 */
export function getRetryAfterSeconds(err: unknown): number {
  if (isAppError(err)) {
    if (err.code.startsWith("RATE_LIMIT_")) return 60;
    if (err.code === ErrorCode.DB_TIMEOUT) return 1;
    if (err.code === ErrorCode.AI_MODEL_OVERLOADED) return 5;
    if (err.code === ErrorCode.SERVICE_UNAVAILABLE) return 10;
    if (err.code === ErrorCode.GATEWAY_TIMEOUT) return 3;
  }

  const statusCode = getErrorStatusCode(err);
  if (statusCode === 429) return 60;
  if (statusCode === 503) return 10;
  if (statusCode === 504) return 3;

  return 0;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Verify that the error handler is operational.
 */
export function pingErrorHandler(): {
  healthy: boolean;
  config: ErrorHandlerConfig;
  errorCodeCount: number;
  allCodesValid: boolean;
  error?: string;
} {
  try {
    const config = getConfig();
    const codes = Object.values(ErrorCode);
    let allCodesValid = true;

    // Verify every error code has a status code mapping
    for (const code of codes) {
      if (!(code in ERROR_CODE_STATUS_MAP)) {
        allCodesValid = false;
        break;
      }
      if (!(code in DEFAULT_ERROR_MESSAGES_EN)) {
        allCodesValid = false;
        break;
      }
    }

    // Verify AppError construction works
    const testError = new AppError(ErrorCode.INTERNAL_SERVER_ERROR, {
      message: "health-check",
    });
    const serialized = testError.toJSON();
    const valid =
      serialized.code === ErrorCode.INTERNAL_SERVER_ERROR &&
      serialized.statusCode === 500 &&
      typeof serialized.errorId === "string";

    return {
      healthy: valid && allCodesValid,
      config,
      errorCodeCount: codes.length,
      allCodesValid,
      error: valid && allCodesValid
        ? undefined
        : "Self-check failed: error construction or code coverage incomplete.",
    };
  } catch (err) {
    return {
      healthy: false,
      config: buildConfig(),
      errorCodeCount: Object.keys(ErrorCode).length,
      allCodesValid: false,
      error: err instanceof Error ? err.message : "Unknown error handler health check error.",
    };
  }
}

// ---------------------------------------------------------------------------
// Convenience: Quick-Throw Helpers
// ---------------------------------------------------------------------------

/**
 * Throw a NOT_FOUND error with a contextual message.
 */
export function throwNotFound(
  resource: string,
  id?: string,
  opts?: AppErrorOptions,
): never {
  throw new AppError(ErrorCode.NOT_FOUND, {
    message: id
      ? `${resource} with ID "${id}" was not found.`
      : `${resource} was not found.`,
    details: { resource, id },
    ...opts,
  });
}

/**
 * Throw an UNAUTHORIZED error.
 */
export function throwUnauthorized(
  message?: string,
  opts?: AppErrorOptions,
): never {
  throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, {
    message: message ?? "Authentication is required to access this resource.",
    ...opts,
  });
}

/**
 * Throw a FORBIDDEN error.
 */
export function throwForbidden(
  message?: string,
  opts?: AppErrorOptions,
): never {
  throw new AppError(ErrorCode.AUTH_FORBIDDEN, {
    message: message ?? "You do not have permission to access this resource.",
    ...opts,
  });
}

/**
 * Throw a VALIDATION_ERROR with details.
 */
export function throwValidationError(
  message: string,
  details?: ValidationErrorDetail[],
  opts?: AppErrorOptions,
): never {
  throw new AppError(ErrorCode.VALIDATION_ERROR, {
    message,
    details,
    ...opts,
  });
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const errorHandler = {
  // Core
  AppError,
  ErrorCode,
  handleError,
  buildErrorResponse,
  serializeError,

  // Messages & i18n
  getDefaultErrorMessage,
  getErrorCodeI18nKey,
  getErrorMessage,
  DEFAULT_ERROR_MESSAGES_EN,
  DEFAULT_ERROR_MESSAGES_RO,

  // Status codes & mapping
  ERROR_CODE_STATUS_MAP,
  getErrorStatusCode,
  getErrorSeverity,
  getErrorDomain,

  // Stack trace
  sanitizeStackTrace,
  getSafeStackTrace,
  getStackSummary,

  // Type guards
  isAppError,
  isKnownError,
  isRetryable,
  getRetryAfterSeconds,

  // Prisma
  parsePrismaError,

  // Builders
  buildValidationError,
  throwNotFound,
  throwUnauthorized,
  throwForbidden,
  throwValidationError,

  // Config
  getConfig,
  reloadConfig: reloadErrorHandlerConfig,

  // Health
  ping: pingErrorHandler,
} as const;

export default errorHandler;