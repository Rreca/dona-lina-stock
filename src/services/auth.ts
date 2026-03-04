/**
 * Authentication service for GitHub PAT token management
 * Handles token storage, validation, and logout
 */

import { cacheService } from './cache';
import { clearSensitiveString, isValidTokenFormat } from '../utils/security';

// ============================================================================
// Types
// ============================================================================

/**
 * Authentication state
 */
export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  gistId: string | null;
  error: string | null;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  scopes?: string[];
}

/**
 * Auth error types
 */
export type AuthErrorType =
  | 'invalid_token'
  | 'expired_token'
  | 'insufficient_scope'
  | 'network_error'
  | 'unknown';

/**
 * Auth error
 */
export class AuthError extends Error {
  type: AuthErrorType;
  originalError?: unknown;

  constructor(type: AuthErrorType, message: string, originalError?: unknown) {
    super(message);
    this.name = 'AuthError';
    this.type = type;
    this.originalError = originalError;
  }
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEYS = {
  TOKEN: 'dona_lina_token',
  GIST_ID: 'dona_lina_gist_id',
  ENCRYPTED_TOKEN: 'dona_lina_encrypted_token',
  ENCRYPTION_ENABLED: 'dona_lina_encryption_enabled',
} as const;

const REQUIRED_SCOPE = 'gist';
const GITHUB_API_BASE = 'https://api.github.com';

// Encryption constants
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

// ============================================================================
// Auth Service
// ============================================================================

/**
 * Service for managing authentication with GitHub PAT tokens
 */
export class AuthService {
  /**
   * Derive a cryptographic key from a passphrase using PBKDF2
   */
  private async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passphraseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      passphraseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt token with passphrase using AES-GCM
   */
  private async encryptToken(token: string, passphrase: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const tokenData = encoder.encode(token);

      // Generate random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // Derive key from passphrase
      const key = await this.deriveKey(passphrase, salt);

      // Encrypt token
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        tokenData
      );

      // Combine salt + iv + encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

      // Convert to base64 for storage
      const combinedArray = Array.from(combined);
      return btoa(String.fromCharCode.apply(null, combinedArray as any));
    } catch (error) {
      // Never log the actual token or error details that might contain it
      throw new AuthError('unknown', 'Failed to encrypt token', error);
    }
  }

  /**
   * Decrypt token with passphrase using AES-GCM
   */
  private async decryptToken(encryptedToken: string, passphrase: string): Promise<string> {
    try {
      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedToken), (c) => c.charCodeAt(0));

      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, SALT_LENGTH);
      const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const encryptedData = combined.slice(SALT_LENGTH + IV_LENGTH);

      // Derive key from passphrase
      const key = await this.deriveKey(passphrase, salt);

      // Decrypt token
      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      // Never log decryption errors that might contain sensitive data
      throw new AuthError('invalid_token', 'Failed to decrypt token. Invalid passphrase?', error);
    }
  }

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.ENCRYPTION_ENABLED) === 'true';
    } catch (error) {
      // Silent failure - don't log storage errors
      return false;
    }
  }

  /**
   * Get the stored token from localStorage (handles both encrypted and plain)
   */
  /**
   * Get the stored token from localStorage (handles both encrypted and plain)
   * For encrypted tokens, passphrase must be provided
   */
  async getTokenAsync(passphrase?: string): Promise<string | null> {
    try {
      if (this.isEncryptionEnabled()) {
        if (!passphrase) {
          throw new AuthError('invalid_token', 'Passphrase required for encrypted token');
        }
        const encryptedToken = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_TOKEN);
        if (!encryptedToken) {
          return null;
        }
        return await this.decryptToken(encryptedToken, passphrase);
      } else {
        return localStorage.getItem(STORAGE_KEYS.TOKEN);
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      // Never log errors that might contain token data
      return null;
    }
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.TOKEN);
    } catch (error) {
      // Silent failure - don't log storage errors
      return null;
    }
  }

  /**
   * Get the stored Gist ID from localStorage
   */
  getGistId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.GIST_ID);
    } catch (error) {
      // Silent failure - don't log storage errors
      return null;
    }
  }

  /**
   * Store token in localStorage (plain text)
   */
  setToken(token: string): void {
    try {
      // Validate token format before storing
      if (!isValidTokenFormat(token)) {
        throw new AuthError('invalid_token', 'Invalid token format. Expected GitHub PAT token.');
      }

      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_TOKEN);
      localStorage.setItem(STORAGE_KEYS.ENCRYPTION_ENABLED, 'false');
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('unknown', 'Failed to store token', error);
    }
  }

  /**
   * Store token in localStorage with encryption
   */
  async setTokenEncrypted(token: string, passphrase: string): Promise<void> {
    try {
      // Validate token format before storing
      if (!isValidTokenFormat(token)) {
        throw new AuthError('invalid_token', 'Invalid token format. Expected GitHub PAT token.');
      }

      const encryptedToken = await this.encryptToken(token, passphrase);
      localStorage.setItem(STORAGE_KEYS.ENCRYPTED_TOKEN, encryptedToken);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.setItem(STORAGE_KEYS.ENCRYPTION_ENABLED, 'true');
      
      // Clear the plaintext token from memory (best effort)
      clearSensitiveString(token);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('unknown', 'Failed to store encrypted token', error);
    }
  }

  /**
   * Store Gist ID in localStorage
   */
  setGistId(gistId: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GIST_ID, gistId);
    } catch (error) {
      throw new AuthError('unknown', 'Failed to store Gist ID', error);
    }
  }

  /**
   * Validate token with GitHub API
   * Checks if token is valid and has required 'gist' scope
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // First validate token format
      if (!isValidTokenFormat(token)) {
        return {
          valid: false,
          error: 'Invalid token format. Expected GitHub PAT token (starts with ghp_, gho_, etc.)',
        };
      }

      const response = await fetch(`${GITHUB_API_BASE}/user`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            valid: false,
            error: 'Invalid or expired token. Please check your Personal Access Token.',
          };
        }
        if (response.status === 403) {
          return {
            valid: false,
            error: 'Token access forbidden. Please check token permissions.',
          };
        }
        return {
          valid: false,
          error: `Token validation failed with status ${response.status}`,
        };
      }

      // Check token scopes
      const scopesHeader = response.headers.get('X-OAuth-Scopes');
      const scopes = scopesHeader ? scopesHeader.split(',').map((s) => s.trim()) : [];

      // Verify 'gist' scope is present
      if (!scopes.includes(REQUIRED_SCOPE)) {
        return {
          valid: false,
          error: `Token missing required '${REQUIRED_SCOPE}' scope. Please create a token with gist permissions.`,
          scopes,
        };
      }

      return {
        valid: true,
        scopes,
      };
    } catch (error) {
      // Never log the error which might contain token data
      return {
        valid: false,
        error: 'Network error during token validation. Please check your connection.',
      };
    }
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    const token = this.getToken();
    const gistId = this.getGistId();

    return {
      isAuthenticated: !!token && !!gistId,
      token,
      gistId,
      error: null,
    };
  }

  /**
   * Logout: clear token, Gist ID, and all cached data
   * Also clears sensitive data from memory
   */
  async logout(): Promise<void> {
    try {
      // Get token before clearing to attempt memory cleanup
      const token = this.getToken();
      
      // Clear token and Gist ID from localStorage
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.ENCRYPTION_ENABLED);
      localStorage.removeItem(STORAGE_KEYS.GIST_ID);

      // Clear all cached data from IndexedDB
      await cacheService.clearAll();
      
      // Best effort to clear token from memory
      if (token) {
        clearSensitiveString(token);
      }
    } catch (error) {
      // Don't log error details that might contain sensitive data
      throw new AuthError('unknown', 'Failed to complete logout', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getGistId();
  }
}

// Export singleton instance
export const authService = new AuthService();
