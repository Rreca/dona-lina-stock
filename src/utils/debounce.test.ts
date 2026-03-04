/**
 * Unit tests for debounce utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, debounceAsync } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay function execution', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should reset delay on subsequent calls', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced();
    vi.advanceTimersByTime(50);

    debounced(); // Reset timer
    vi.advanceTimersByTime(50);
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the function', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(func).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should only call function once for multiple rapid calls', () => {
    const func = vi.fn();
    const debounced = debounce(func, 100);

    debounced();
    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });
});

describe('debounceAsync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay async function execution', async () => {
    const func = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(func, 100);

    const promise = debounced();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    await promise;

    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should return the result of the async function', async () => {
    const func = vi.fn().mockResolvedValue('test result');
    const debounced = debounceAsync(func, 100);

    const promise = debounced();
    vi.advanceTimersByTime(100);
    const result = await promise;

    expect(result).toBe('test result');
  });

  it('should pass arguments to the async function', async () => {
    const func = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(func, 100);

    const promise = debounced('arg1', 123);
    vi.advanceTimersByTime(100);
    await promise;

    expect(func).toHaveBeenCalledWith('arg1', 123);
  });
});
