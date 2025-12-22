// ABOUTME: Path validation utilities for IPC handlers.
// ABOUTME: Validates paths received from renderer to prevent injection attacks.

/**
 * Validates that a value is a valid file path string.
 * Throws if the value is not a valid path.
 *
 * Checks:
 * - Must be a non-empty string
 * - Must not contain null bytes (common injection attack vector)
 * - Must not exceed 4096 characters (filesystem limit)
 */
export function validateFilePath(filePath: unknown): asserts filePath is string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path: path must be a non-empty string');
  }

  if (filePath.includes('\0')) {
    throw new Error('Invalid file path: null bytes not allowed');
  }

  if (filePath.length > 4096) {
    throw new Error('Invalid file path: path too long (max 4096 characters)');
  }
}
