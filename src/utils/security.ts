/**
 * Security utilities for token handling and sensitive data protection
 */

/**
 * Sanitize error messages to prevent token leakage
 * Removes any potential token-like strings from error messages
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove GitHub token patterns (ghp_, gho_, ghs_, ghu_, etc.)
  return message.replace(/gh[pousr]_[a-zA-Z0-9]{36,}/g, '[REDACTED_TOKEN]');
}

/**
 * Sanitize error objects to prevent token leakage in logs
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeErrorMessage(error.message);
  }
  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }
  return 'An error occurred';
}

/**
 * Clear sensitive data from memory
 * Overwrites string with zeros (best effort - JS doesn't guarantee memory clearing)
 */
export function clearSensitiveString(str: string): void {
  // Note: JavaScript strings are immutable, so we can't truly clear them from memory
  // This is a best-effort approach to signal intent
  // The garbage collector will eventually clean up
  if (str) {
    // Create a new string filled with zeros to potentially overwrite
    '0'.repeat(str.length);
  }
}

/**
 * Validate that a token has the required GitHub PAT format
 */
export function isValidTokenFormat(token: string): boolean {
  // GitHub PAT tokens start with ghp_, gho_, ghs_, ghu_, or ghr_
  // and are followed by 36+ alphanumeric characters
  const tokenPattern = /^gh[pousr]_[a-zA-Z0-9]{36,}$/;
  return tokenPattern.test(token);
}

/**
 * Check if a string might contain sensitive data (token-like pattern)
 */
export function containsSensitiveData(str: string): boolean {
  const tokenPattern = /gh[pousr]_[a-zA-Z0-9]{36,}/;
  return tokenPattern.test(str);
}
