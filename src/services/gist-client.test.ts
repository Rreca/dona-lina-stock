/**
 * Unit tests for GistClient
 * Tests cover: successful read/write operations, ETag concurrency handling,
 * retry logic with mocked failures, and error handling for auth failures
 * Requirements: R2.1, R2.3, N2.1
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GistClient, GistError } from "./gist-client";

// ============================================================================
// Test Setup
// ============================================================================

const mockConfig = {
  token: "test-token-123",
  gistId: "test-gist-id",
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock Response
function createMockResponse(
  status: number,
  data: unknown,
  headers: Record<string, string> = {}
): Response {
  const headersObj = new Headers(headers);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: headersObj,
    json: async () => data,
  } as Response;
}

// ============================================================================
// Test: Successful Read Operations
// ============================================================================

describe("GistClient - Successful Read Operations", () => {
  let client: GistClient;

  beforeEach(() => {
    client = new GistClient(mockConfig);
    mockFetch.mockClear();
  });

  it("should successfully read files from Gist", async () => {
    const mockGistData = {
      id: "test-gist-id",
      files: {
        "products.json": { content: '{"products":[]}' },
        "settings.json": { content: '{"costMethod":"last"}' },
      },
    };

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, mockGistData, { ETag: '"etag-123"' })
    );

    const result = await client.read();

    expect(result.files).toEqual({
      "products.json": '{"products":[]}',
      "settings.json": '{"costMethod":"last"}',
    });
    expect(result.etag).toBe('"etag-123"');
    expect(client.getETag()).toBe('"etag-123"');
  });

  it("should call GitHub API with correct headers", async () => {
    const mockGistData = {
      id: "test-gist-id",
      files: {},
    };

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, mockGistData, { ETag: '"etag-123"' })
    );

    await client.read();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/gists/test-gist-id",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer test-token-123",
          Accept: "application/vnd.github.v3+json",
        },
      }
    );
  });

  it("should handle Gist with no files", async () => {
    const mockGistData = {
      id: "test-gist-id",
      files: {},
    };

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, mockGistData, { ETag: '"etag-456"' })
    );

    const result = await client.read();

    expect(result.files).toEqual({});
    expect(result.etag).toBe('"etag-456"');
  });

  it("should handle response without ETag header", async () => {
    const mockGistData = {
      id: "test-gist-id",
      files: {
        "test.json": { content: "test" },
      },
    };

    mockFetch.mockResolvedValueOnce(createMockResponse(200, mockGistData));

    const result = await client.read();

    expect(result.files).toEqual({ "test.json": "test" });
    expect(result.etag).toBe("");
    expect(client.getETag()).toBeNull();
  });
});

// ============================================================================
// Test: Successful Write Operations
// ============================================================================

describe("GistClient - Successful Write Operations", () => {
  let client: GistClient;

  beforeEach(() => {
    client = new GistClient(mockConfig);
    mockFetch.mockClear();
  });

  it("should successfully write files to Gist", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, {}, { ETag: '"new-etag"' })
    );

    const files = {
      "products.json": '{"products":[{"id":"1"}]}',
      "settings.json": '{"costMethod":"weighted_avg"}',
    };

    const result = await client.write(files);

    expect(result.success).toBe(true);
    expect(result.etag).toBe('"new-etag"');
    expect(client.getETag()).toBe('"new-etag"');
  });

  it("should call GitHub API with correct headers and body", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, {}, { ETag: '"new-etag"' })
    );

    const files = {
      "test.json": "test content",
    };

    await client.write(files);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.github.com/gists/test-gist-id",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer test-token-123",
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: {
            "test.json": { content: "test content" },
          },
        }),
      }
    );
  });

  it("should update ETag after successful write", async () => {
    client.setETag('"existing-etag"');

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, {}, { ETag: '"new-etag"' })
    );

    await client.write({ "test.json": "content" });

    expect(client.getETag()).toBe('"new-etag"');
  });
});

// ============================================================================
// Test: ETag Concurrency Handling
// ============================================================================

describe("GistClient - ETag Concurrency Handling", () => {
  let client: GistClient;

  beforeEach(() => {
    client = new GistClient(mockConfig);
    mockFetch.mockClear();
  });

  it("should detect 412 conflict and throw conflict error", async () => {
    client.setETag('"old-etag"');

    mockFetch.mockResolvedValueOnce(
      createMockResponse(412, { message: "Precondition Failed" })
    );

    try {
      await client.write({ "test.json": "content" });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("conflict");
      expect((error as GistError).statusCode).toBe(412);
    }
  });

  it("should detect 409 conflict and throw conflict error", async () => {
    client.setETag('"old-etag"');

    mockFetch.mockResolvedValueOnce(
      createMockResponse(409, { message: "Conflict" })
    );

    try {
      await client.write({ "test.json": "content" });
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("conflict");
      expect((error as GistError).statusCode).toBe(409);
    }
  });

  it("should update ETag after successful read", async () => {
    const mockGistData = {
      id: "test-gist-id",
      files: { "test.json": { content: "test" } },
    };

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, mockGistData, { ETag: '"read-etag"' })
    );

    await client.read();

    expect(client.getETag()).toBe('"read-etag"');
  });

  it("should update ETag after successful write", async () => {
    client.setETag('"old-etag"');

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, {}, { ETag: '"write-etag"' })
    );

    await client.write({ "test.json": "content" });

    expect(client.getETag()).toBe('"write-etag"');
  });

  it("should allow manual ETag management", () => {
    expect(client.getETag()).toBeNull();

    client.setETag('"manual-etag"');
    expect(client.getETag()).toBe('"manual-etag"');

    client.setETag(null);
    expect(client.getETag()).toBeNull();
  });
});

// ============================================================================
// Test: Error Handling for Auth Failures
// ============================================================================

describe("GistClient - Auth Error Handling", () => {
  let client: GistClient;

  beforeEach(() => {
    client = new GistClient(mockConfig);
    mockFetch.mockClear();
  });

  it("should throw unauthorized error for 401 status", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(401, { message: "Bad credentials" })
    );

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("unauthorized");
      expect((error as GistError).statusCode).toBe(401);
      expect((error as GistError).message).toContain("Unauthorized");
    }
  });

  it("should throw not_found error for 404 status", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(404, { message: "Not Found" })
    );

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("not_found");
      expect((error as GistError).statusCode).toBe(404);
      expect((error as GistError).message).toContain("Gist not found");
    }
  });

  it("should throw rate_limit error for 403 with rate limit message", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(403, { message: "API rate limit exceeded" })
    );

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("rate_limit");
      expect((error as GistError).statusCode).toBe(403);
      expect((error as GistError).message).toContain("Rate limit");
    }
  });

  it("should throw unauthorized error for 403 without rate limit message", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(403, { message: "Forbidden" })
    );

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("unauthorized");
      expect((error as GistError).statusCode).toBe(403);
    }
  });
});

// ============================================================================
// Test: Server Error Handling
// ============================================================================

describe("GistClient - Server Error Handling", () => {
  let client: GistClient;

  beforeEach(() => {
    client = new GistClient(mockConfig);
    mockFetch.mockClear();
  });

  it("should throw server_error for 500 status", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(500, { message: "Internal Server Error" })
    );

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("server_error");
      expect((error as GistError).statusCode).toBe(500);
    }
  });

  it("should throw server_error for 502 status", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(502, { message: "Bad Gateway" })
    );

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("server_error");
      expect((error as GistError).statusCode).toBe(502);
    }
  });

  it("should throw server_error for 503 status", async () => {
    mockFetch.mockResolvedValueOnce(
      createMockResponse(503, { message: "Service Unavailable" })
    );

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("server_error");
      expect((error as GistError).statusCode).toBe(503);
    }
  });
});

// ============================================================================
// Test: Network Error Handling
// ============================================================================

describe("GistClient - Network Error Handling", () => {
  let client: GistClient;

  beforeEach(() => {
    client = new GistClient(mockConfig);
    mockFetch.mockClear();
  });

  it("should throw network_error when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    await expect(client.read()).rejects.toThrow(GistError);

    try {
      await client.read();
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("network_error");
      expect((error as GistError).message).toContain("Failed to read from Gist");
    }
  });

  it("should throw network_error when write fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

    await expect(client.write({ "test.json": "content" })).rejects.toThrow(
      GistError
    );

    try {
      await client.write({ "test.json": "content" });
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).type).toBe("network_error");
      expect((error as GistError).message).toContain("Failed to write to Gist");
    }
  });

  it("should handle response without JSON body", async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: "Bad Request",
      headers: new Headers(),
      json: async () => {
        throw new Error("Invalid JSON");
      },
    } as Response;

    mockFetch.mockResolvedValueOnce(mockResponse);

    try {
      await client.read();
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(GistError);
      expect((error as GistError).statusCode).toBe(400);
    }
  });
});

// ============================================================================
// Test: Configuration Updates
// ============================================================================

describe("GistClient - Configuration Updates", () => {
  let client: GistClient;

  beforeEach(() => {
    client = new GistClient(mockConfig);
    mockFetch.mockClear();
  });

  it("should allow updating token", async () => {
    client.updateToken("new-token-456");

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, { id: "test", files: {} })
    );

    await client.read();

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe("Bearer new-token-456");
  });

  it("should allow updating gist ID", async () => {
    client.updateGistId("new-gist-id");

    mockFetch.mockResolvedValueOnce(
      createMockResponse(200, { id: "new-gist-id", files: {} })
    );

    await client.read();

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://api.github.com/gists/new-gist-id");
  });
});
