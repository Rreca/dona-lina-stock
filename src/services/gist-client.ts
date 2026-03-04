/**
 * GitHub Gist API client for persistence
 * Handles authentication, reading, and writing Gist files with ETag-based concurrency control
 */

// ============================================================================
// Types
// ============================================================================

/**
 * GitHub Gist file content
 */
export interface GistFile {
  filename: string;
  content: string;
}

/**
 * GitHub Gist response structure
 */
export interface GistResponse {
  id: string;
  files: Record<string, { content: string }>;
}

/**
 * Gist client configuration
 */
export interface GistClientConfig {
  token: string;
  gistId: string;
}

/**
 * Result of a Gist read operation
 */
export interface GistReadResult {
  files: Record<string, string>; // filename -> content
  etag: string;
}

/**
 * Result of a Gist write operation
 */
export interface GistWriteResult {
  success: boolean;
  etag: string;
}

/**
 * Gist API error types
 */
export type GistErrorType =
  | "unauthorized" // 401
  | "not_found" // 404
  | "conflict" // 409/412
  | "rate_limit" // 403
  | "server_error" // 500, 502, 503
  | "network_error"
  | "unknown";

/**
 * Gist API error
 */
export class GistError extends Error {
  type: GistErrorType;
  statusCode?: number;
  originalError?: unknown;

  constructor(
    type: GistErrorType,
    message: string,
    statusCode?: number,
    originalError?: unknown
  ) {
    super(message);
    this.name = "GistError";
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

// ============================================================================
// GitHub Gist API Client
// ============================================================================

/**
 * Client for interacting with GitHub Gist API
 * Provides methods for reading and writing Gist files with ETag-based concurrency control
 */
export class GistClient {
  private config: GistClientConfig;
  private etag: string | null = null;
  private readonly baseUrl = "https://api.github.com";

  constructor(config: GistClientConfig) {
    this.config = config;
  }

  /**
   * Get the current stored ETag
   */
  getETag(): string | null {
    return this.etag;
  }

  /**
   * Set the ETag manually (useful for restoring from cache)
   */
  setETag(etag: string | null): void {
    this.etag = etag;
  }

  /**
   * Read all files from the Gist
   * Stores the ETag from the response for subsequent writes
   */
  async read(): Promise<GistReadResult> {
    try {
      const response = await fetch(`${this.baseUrl}/gists/${this.config.gistId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      // Store ETag for concurrency control
      const etag = response.headers.get("ETag");
      if (etag) {
        this.etag = etag;
      }

      if (!response.ok) {
        throw await this.createErrorFromResponse(response);
      }

      const data: GistResponse = await response.json();

      // Extract file contents
      const files: Record<string, string> = {};
      for (const [filename, fileData] of Object.entries(data.files)) {
        files[filename] = fileData.content;
      }

      return {
        files,
        etag: this.etag || "",
      };
    } catch (error) {
      if (error instanceof GistError) {
        throw error;
      }
      throw new GistError("network_error", "Failed to read from Gist", undefined, error);
    }
  }

  /**
   * Write files to the Gist
   *
   * @param files - Map of filename to content (use null to delete a file)
   */
  async write(files: Record<string, string | null>): Promise<GistWriteResult> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.config.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      };

      // Format files for GitHub API
      const gistFiles: Record<string, { content: string } | null> = {};
      for (const [filename, content] of Object.entries(files)) {
        if (content === null) {
          // Delete file by setting the entire entry to null (not { content: null })
          gistFiles[filename] = null;
        } else {
          gistFiles[filename] = { content };
        }
      }

      const response = await fetch(`${this.baseUrl}/gists/${this.config.gistId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ files: gistFiles }),
      });

      // Update ETag from response
      const newEtag = response.headers.get("ETag");
      if (newEtag) {
        this.etag = newEtag;
      }

      if (!response.ok) {
        throw await this.createErrorFromResponse(response);
      }

      return {
        success: true,
        etag: this.etag || "",
      };
    } catch (error) {
      if (error instanceof GistError) {
        throw error;
      }
      throw new GistError("network_error", "Failed to write to Gist", undefined, error);
    }
  }

  /**
   * Create a GistError from a fetch Response
   */
  private async createErrorFromResponse(response: Response): Promise<GistError> {
    const statusCode = response.status;
    let message = response.statusText;

    try {
      const errorData = await response.json();
      if (errorData.message) {
        message = errorData.message;
      }
    } catch {
      // Ignore JSON parse errors
    }

    // Map status codes to error types
    switch (statusCode) {
      case 401:
        return new GistError("unauthorized", `Unauthorized: ${message}`, statusCode);
      case 404:
        return new GistError("not_found", `Gist not found: ${message}`, statusCode);
      case 409:
      case 412:
        return new GistError("conflict", `Conflict detected: ${message}`, statusCode);
      case 403:
        // Could be rate limiting or forbidden
        if (message.toLowerCase().includes("rate limit")) {
          return new GistError("rate_limit", `Rate limit exceeded: ${message}`, statusCode);
        }
        return new GistError("unauthorized", `Forbidden: ${message}`, statusCode);
      case 500:
      case 502:
      case 503:
        return new GistError("server_error", `Server error: ${message}`, statusCode);
      default:
        return new GistError("unknown", `HTTP ${statusCode}: ${message}`, statusCode);
    }
  }

  /**
   * Update the authentication token
   */
  updateToken(token: string): void {
    this.config.token = token;
  }

  /**
   * Update the Gist ID
   */
  updateGistId(gistId: string): void {
    this.config.gistId = gistId;
  }
}
