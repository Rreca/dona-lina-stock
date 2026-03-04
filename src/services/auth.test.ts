/**
 * Unit tests for auth service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from './auth';

// Mock the cache service to avoid IndexedDB issues in tests
vi.mock('./cache', () => ({
  cacheService: {
    clearAll: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    authService = new AuthService();
    // Clear localStorage before each test
    localStorage.clear();
    // Store original fetch
    originalFetch = globalThis.fetch;
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Token storage and retrieval', () => {
    it('should store and retrieve token', () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      authService.setToken(token);
      expect(authService.getToken()).toBe(token);
    });

    it('should store and retrieve Gist ID', () => {
      const gistId = 'abc123def456';
      authService.setGistId(gistId);
      expect(authService.getGistId()).toBe(gistId);
    });

    it('should return null when no token is stored', () => {
      expect(authService.getToken()).toBeNull();
    });

    it('should return null when no Gist ID is stored', () => {
      expect(authService.getGistId()).toBeNull();
    });
  });

  describe('Token validation', () => {
    it('should validate a valid token with gist scope', async () => {
      const mockToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'X-OAuth-Scopes') return 'gist, repo';
            return null;
          },
        },
      });

      const result = await authService.validateToken(mockToken);

      expect(result.valid).toBe(true);
      expect(result.scopes).toContain('gist');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should reject token without gist scope', async () => {
      const mockToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => {
            if (name === 'X-OAuth-Scopes') return 'repo, user';
            return null;
          },
        },
      });

      const result = await authService.validateToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('gist');
      expect(result.error).toContain('scope');
    });

    it('should reject invalid token (401)', async () => {
      const mockToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: { get: () => null },
      });

      const result = await authService.validateToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid or expired token');
    });

    it('should handle 403 forbidden error', async () => {
      const mockToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: { get: () => null },
      });

      const result = await authService.validateToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('forbidden');
    });

    it('should handle network errors', async () => {
      const mockToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';

      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      const result = await authService.validateToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle empty scopes header', async () => {
      const mockToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => null,
        },
      });

      const result = await authService.validateToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('gist');
    });
  });

  describe('Authentication state', () => {
    it('should return authenticated state when token and gistId are present', () => {
      authService.setToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz123456');
      authService.setGistId('gist123');

      const state = authService.getAuthState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('ghp_1234567890abcdefghijklmnopqrstuvwxyz123456');
      expect(state.gistId).toBe('gist123');
      expect(state.error).toBeNull();
    });

    it('should return unauthenticated state when token is missing', () => {
      authService.setGistId('gist123');

      const state = authService.getAuthState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
    });

    it('should return unauthenticated state when gistId is missing', () => {
      authService.setToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz123456');

      const state = authService.getAuthState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.gistId).toBeNull();
    });

    it('should check authentication status', () => {
      expect(authService.isAuthenticated()).toBe(false);

      authService.setToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz123456');
      authService.setGistId('gist123');

      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('Logout', () => {
    it('should clear token and gistId from localStorage', async () => {
      authService.setToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz123456');
      authService.setGistId('gist123');

      await authService.logout();

      expect(authService.getToken()).toBeNull();
      expect(authService.getGistId()).toBeNull();
    });

    it('should clear cache on logout', async () => {
      authService.setToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz123456');
      authService.setGistId('gist123');

      const { cacheService } = await import('./cache');

      await authService.logout();

      expect(cacheService.clearAll).toHaveBeenCalledOnce();
    });

    it('should handle cache clear errors gracefully', async () => {
      authService.setToken('ghp_1234567890abcdefghijklmnopqrstuvwxyz123456');
      authService.setGistId('gist123');

      const { cacheService } = await import('./cache');
      vi.mocked(cacheService.clearAll).mockRejectedValueOnce(new Error('Cache error'));

      await expect(authService.logout()).rejects.toThrow('Failed to complete logout');

      // Token and gistId should still be cleared even if cache fails
      expect(authService.getToken()).toBeNull();
      expect(authService.getGistId()).toBeNull();
    });
  });

  describe('Token encryption', () => {
    it('should encrypt and decrypt token with passphrase', async () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const passphrase = 'my-secure-passphrase';

      await authService.setTokenEncrypted(token, passphrase);

      expect(authService.isEncryptionEnabled()).toBe(true);
      expect(authService.getToken()).toBeNull(); // Plain token should not be available

      const decryptedToken = await authService.getTokenAsync(passphrase);
      expect(decryptedToken).toBe(token);
    });

    it('should fail to decrypt with wrong passphrase', async () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const passphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';

      await authService.setTokenEncrypted(token, passphrase);

      await expect(authService.getTokenAsync(wrongPassphrase)).rejects.toThrow(
        'Failed to decrypt token'
      );
    });

    it('should require passphrase for encrypted token', async () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const passphrase = 'my-passphrase';

      await authService.setTokenEncrypted(token, passphrase);

      await expect(authService.getTokenAsync()).rejects.toThrow(
        'Passphrase required for encrypted token'
      );
    });

    it('should switch from plain to encrypted token', async () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const passphrase = 'my-passphrase';

      // Store plain token first
      authService.setToken(token);
      expect(authService.isEncryptionEnabled()).toBe(false);
      expect(authService.getToken()).toBe(token);

      // Switch to encrypted
      await authService.setTokenEncrypted(token, passphrase);
      expect(authService.isEncryptionEnabled()).toBe(true);
      expect(authService.getToken()).toBeNull();

      const decryptedToken = await authService.getTokenAsync(passphrase);
      expect(decryptedToken).toBe(token);
    });

    it('should switch from encrypted to plain token', async () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const passphrase = 'my-passphrase';

      // Store encrypted token first
      await authService.setTokenEncrypted(token, passphrase);
      expect(authService.isEncryptionEnabled()).toBe(true);

      // Switch to plain
      authService.setToken(token);
      expect(authService.isEncryptionEnabled()).toBe(false);
      expect(authService.getToken()).toBe(token);
    });

    it('should handle encryption errors gracefully', async () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const passphrase = '';

      // Empty passphrase should still work but is not recommended
      await expect(authService.setTokenEncrypted(token, passphrase)).resolves.not.toThrow();
    });

    it('should clear encrypted token on logout', async () => {
      const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123456';
      const passphrase = 'my-passphrase';

      await authService.setTokenEncrypted(token, passphrase);
      authService.setGistId('gist123');

      await authService.logout();

      expect(authService.isEncryptionEnabled()).toBe(false);
      expect(authService.getToken()).toBeNull();
      await expect(authService.getTokenAsync(passphrase)).resolves.toBeNull();
    });
  });
});
