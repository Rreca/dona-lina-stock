/**
 * Retry logic with exponential backoff for transient errors
 */

import { GistError } from "./gist-client";

// ============================================================================
// Types
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Determine if an error is retryable
 *
 * Retryable errors:
 * - network_error (timeouts, connection failures)
 * - server_error (500, 502, 503)
 * - rate_limit (403 with rate limit message)
 *
 * Non-retryable errors:
 * - unauthorized (401)
 * - not_found (404)
 * - conflict (409, 412) - should be handled by conflict resolution
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof GistError) {
    return (
      error.type === "network_error" ||
      error.type === "server_error" ||
      error.type === "rate_limit"
    );
  }
  return false;
}

/**
 * Calculate delay for exponential backoff
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param operation - Async function to retry
 * @param config - Retry configuration
 * @returns RetryResult with success status and data or error
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<RetryResult<T>> {
  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    attempts = attempt;

    try {
      const data = await operation();
      return {
        success: true,
        data,
        attempts,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(error)) {
        // Non-retryable error, fail immediately
        return {
          success: false,
          error: lastError,
          attempts,
        };
      }

      // If this was the last attempt, don't wait
      if (attempt === config.maxAttempts) {
        break;
      }

      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt, config);

      // Add jitter (random 0-20% of delay) to prevent thundering herd
      const jitter = Math.random() * 0.2 * delay;
      const totalDelay = delay + jitter;

      // Wait before retrying
      await sleep(totalDelay);
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError,
    attempts,
  };
}

/**
 * Retry wrapper for GistClient operations
 * Automatically retries transient errors with exponential backoff
 */
export class RetryableGistClient {
  private config: RetryConfig;

  constructor(config: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = config;
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const result = await retryWithBackoff(operation, this.config);

    if (result.success && result.data !== undefined) {
      return result.data;
    }

    throw result.error || new Error("Operation failed after retries");
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current retry configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
