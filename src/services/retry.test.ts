/**
 * Unit tests for retry logic with exponential backoff
 * Tests cover: retry logic with mocked failures, transient error detection,
 * backoff calculation, and non-retryable error handling
 * Requirements: N2.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isRetryableError,
  calculateBackoffDelay,
  retryWithBackoff,
  RetryableGistClient,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from "./retry";
import { GistError } from "./gist-client";

// ============================================================================
// Test: Retryable Error Detection
// ============================================================================

describe("isRetryableError", () => {
  it("should return true for network_error", () => {
    const error = new GistError("network_error", "Network timeout");
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for server_error", () => {
    const error = new GistError("server_error", "Internal server error", 500);
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return true for rate_limit", () => {
    const error = new GistError("rate_limit", "Rate limit exceeded", 403);
    expect(isRetryableError(error)).toBe(true);
  });

  it("should return false for unauthorized", () => {
    const error = new GistError("unauthorized", "Bad credentials", 401);
    expect(isRetryableError(error)).toBe(false);
  });

  it("should return false for not_found", () => {
    const error = new GistError("not_found", "Gist not found", 404);
    expect(isRetryableError(error)).toBe(false);
  });

  it("should return false for conflict", () => {
    const error = new GistError("conflict", "ETag mismatch", 412);
    expect(isRetryableError(error)).toBe(false);
  });

  it("should return false for unknown error types", () => {
    const error = new GistError("unknown", "Unknown error", 400);
    expect(isRetryableError(error)).toBe(false);
  });

  it("should return false for non-GistError errors", () => {
    const error = new Error("Generic error");
    expect(isRetryableError(error)).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

// ============================================================================
// Test: Backoff Delay Calculation
// ============================================================================

describe("calculateBackoffDelay", () => {
  it("should calculate exponential backoff correctly", () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };

    expect(calculateBackoffDelay(1, config)).toBe(1000); // 1000 * 2^0
    expect(calculateBackoffDelay(2, config)).toBe(2000); // 1000 * 2^1
    expect(calculateBackoffDelay(3, config)).toBe(4000); // 1000 * 2^2
    expect(calculateBackoffDelay(4, config)).toBe(8000); // 1000 * 2^3
  });

  it("should cap delay at maxDelayMs", () => {
    const config: RetryConfig = {
      maxAttempts: 10,
      initialDelayMs: 1000,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    };

    expect(calculateBackoffDelay(5, config)).toBe(5000); // Would be 16000, capped at 5000
    expect(calculateBackoffDelay(10, config)).toBe(5000); // Would be 512000, capped at 5000
  });

  it("should use default config when not provided", () => {
    expect(calculateBackoffDelay(1)).toBe(DEFAULT_RETRY_CONFIG.initialDelayMs);
    expect(calculateBackoffDelay(2)).toBe(
      DEFAULT_RETRY_CONFIG.initialDelayMs * DEFAULT_RETRY_CONFIG.backoffMultiplier
    );
  });

  it("should handle different backoff multipliers", () => {
    const config: RetryConfig = {
      maxAttempts: 5,
      initialDelayMs: 100,
      maxDelayMs: 10000,
      backoffMultiplier: 3,
    };

    expect(calculateBackoffDelay(1, config)).toBe(100); // 100 * 3^0
    expect(calculateBackoffDelay(2, config)).toBe(300); // 100 * 3^1
    expect(calculateBackoffDelay(3, config)).toBe(900); // 100 * 3^2
  });
});

// ============================================================================
// Test: Retry with Backoff - Success Cases
// ============================================================================

describe("retryWithBackoff - Success Cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should succeed on first attempt", async () => {
    const operation = vi.fn().mockResolvedValue("success");

    const promise = retryWithBackoff(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should succeed after retryable failures", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new GistError("network_error", "Timeout"))
      .mockRejectedValueOnce(new GistError("server_error", "Server error", 503))
      .mockResolvedValueOnce("success");

    const promise = retryWithBackoff(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("should return data of correct type", async () => {
    const operation = vi.fn().mockResolvedValue({ id: "123", value: 456 });

    const promise = retryWithBackoff(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: "123", value: 456 });
  });
});

// ============================================================================
// Test: Retry with Backoff - Failure Cases
// ============================================================================

describe("retryWithBackoff - Failure Cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fail immediately for non-retryable errors", async () => {
    const error = new GistError("unauthorized", "Bad credentials", 401);
    const operation = vi.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should fail after max attempts with retryable errors", async () => {
    const error = new GistError("network_error", "Timeout");
    const operation = vi.fn().mockRejectedValue(error);

    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    };

    const promise = retryWithBackoff(operation, config);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("should handle conflict errors without retry", async () => {
    const error = new GistError("conflict", "ETag mismatch", 412);
    const operation = vi.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBe(error);
    expect(result.attempts).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should handle not_found errors without retry", async () => {
    const error = new GistError("not_found", "Gist not found", 404);
    const operation = vi.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
  });
});

// ============================================================================
// Test: Retry with Backoff - Timing
// ============================================================================

describe("retryWithBackoff - Timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should wait with exponential backoff between retries", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new GistError("network_error", "Timeout"))
      .mockRejectedValueOnce(new GistError("network_error", "Timeout"))
      .mockResolvedValueOnce("success");

    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };

    const promise = retryWithBackoff(operation, config);

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);

    // Wait for first backoff (1000ms + jitter)
    await vi.advanceTimersByTimeAsync(1500);
    expect(operation).toHaveBeenCalledTimes(2);

    // Wait for second backoff (2000ms + jitter)
    await vi.advanceTimersByTimeAsync(2500);
    expect(operation).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result.success).toBe(true);
  });

  it("should not wait after last attempt", async () => {
    const operation = vi.fn().mockRejectedValue(new GistError("network_error", "Timeout"));

    const config: RetryConfig = {
      maxAttempts: 2,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };

    const promise = retryWithBackoff(operation, config);

    await vi.advanceTimersByTimeAsync(0);
    expect(operation).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1500);
    expect(operation).toHaveBeenCalledTimes(2);

    // Should not wait after last attempt
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
  });
});

// ============================================================================
// Test: RetryableGistClient
// ============================================================================

describe("RetryableGistClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should execute operation successfully", async () => {
    const client = new RetryableGistClient();
    const operation = vi.fn().mockResolvedValue("result");

    const promise = client.execute(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("result");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors", async () => {
    const client = new RetryableGistClient({
      maxAttempts: 3,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });

    const operation = vi
      .fn()
      .mockRejectedValueOnce(new GistError("network_error", "Timeout"))
      .mockResolvedValueOnce("success");

    const promise = client.execute(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should throw error after all retries exhausted", async () => {
    const client = new RetryableGistClient({
      maxAttempts: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });

    const error = new GistError("network_error", "Timeout");
    const operation = vi.fn().mockRejectedValue(error);

    const promise = client.execute(operation).catch((e) => e);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(error);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should throw immediately for non-retryable errors", async () => {
    const client = new RetryableGistClient();
    const error = new GistError("unauthorized", "Bad credentials", 401);
    const operation = vi.fn().mockRejectedValue(error);

    const promise = client.execute(operation).catch((e) => e);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should allow updating retry configuration", () => {
    const client = new RetryableGistClient(DEFAULT_RETRY_CONFIG);

    expect(client.getConfig()).toEqual(DEFAULT_RETRY_CONFIG);

    client.updateConfig({ maxAttempts: 5, initialDelayMs: 500 });

    const updatedConfig = client.getConfig();
    expect(updatedConfig.maxAttempts).toBe(5);
    expect(updatedConfig.initialDelayMs).toBe(500);
    expect(updatedConfig.backoffMultiplier).toBe(DEFAULT_RETRY_CONFIG.backoffMultiplier);
  });

  it("should use default config when not provided", () => {
    const client = new RetryableGistClient();
    expect(client.getConfig()).toEqual(DEFAULT_RETRY_CONFIG);
  });

  it("should handle rate limit errors with retry", async () => {
    const client = new RetryableGistClient({
      maxAttempts: 2,
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
    });

    const operation = vi
      .fn()
      .mockRejectedValueOnce(new GistError("rate_limit", "Rate limit exceeded", 403))
      .mockResolvedValueOnce("success");

    const promise = client.execute(operation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
