// ABOUTME: Tests for path validation utility used by IPC handlers.
// ABOUTME: Ensures malicious paths from renderer are rejected.

import { describe, it, expect } from 'vitest';
import { validateFilePath } from './pathValidation';

describe('validateFilePath', () => {
  describe('valid paths', () => {
    it('should accept absolute Unix paths', () => {
      expect(() => validateFilePath('/home/user/file.sql')).not.toThrow();
    });

    it('should accept absolute Windows paths', () => {
      expect(() => validateFilePath('C:\\Users\\file.sql')).not.toThrow();
    });

    it('should accept relative paths', () => {
      expect(() => validateFilePath('./relative/path.sql')).not.toThrow();
    });

    it('should accept paths with spaces', () => {
      expect(() => validateFilePath('/home/user/my file.sql')).not.toThrow();
    });

    it('should accept paths with special characters', () => {
      expect(() => validateFilePath('/home/user/file-name_v2.sql')).not.toThrow();
    });

    it('should accept paths with unicode characters', () => {
      expect(() => validateFilePath('/home/user/文件.sql')).not.toThrow();
    });

    it('should accept single character path', () => {
      expect(() => validateFilePath('/')).not.toThrow();
    });
  });

  describe('null byte injection', () => {
    it('should reject paths containing null bytes', () => {
      expect(() => validateFilePath('/home/user\0/file.sql')).toThrow('null bytes');
    });

    it('should reject paths with null byte at start', () => {
      expect(() => validateFilePath('\0/home/user/file.sql')).toThrow('null bytes');
    });

    it('should reject paths with null byte at end', () => {
      expect(() => validateFilePath('/home/user/file.sql\0')).toThrow('null bytes');
    });

    it('should reject paths with multiple null bytes', () => {
      expect(() => validateFilePath('/home\0/user\0/file.sql')).toThrow('null bytes');
    });
  });

  describe('path length limits', () => {
    it('should reject paths longer than 4096 characters', () => {
      const longPath = '/home/' + 'a'.repeat(4100);
      expect(() => validateFilePath(longPath)).toThrow('path too long');
    });

    it('should accept paths exactly 4096 characters', () => {
      const maxPath = '/home/' + 'a'.repeat(4090);
      expect(() => validateFilePath(maxPath)).not.toThrow();
    });

    it('should accept paths shorter than 4096 characters', () => {
      const normalPath = '/home/user/file.sql';
      expect(() => validateFilePath(normalPath)).not.toThrow();
    });
  });

  describe('invalid types', () => {
    it('should reject empty strings', () => {
      expect(() => validateFilePath('')).toThrow('non-empty string');
    });

    it('should reject null', () => {
      expect(() => validateFilePath(null)).toThrow('non-empty string');
    });

    it('should reject undefined', () => {
      expect(() => validateFilePath(undefined)).toThrow('non-empty string');
    });

    it('should reject numbers', () => {
      expect(() => validateFilePath(123)).toThrow('non-empty string');
    });

    it('should reject zero', () => {
      expect(() => validateFilePath(0)).toThrow('non-empty string');
    });

    it('should reject objects', () => {
      expect(() => validateFilePath({ path: '/home/user' })).toThrow('non-empty string');
    });

    it('should reject arrays', () => {
      expect(() => validateFilePath(['/home/user'])).toThrow('non-empty string');
    });

    it('should reject boolean true', () => {
      expect(() => validateFilePath(true)).toThrow('non-empty string');
    });

    it('should reject boolean false', () => {
      expect(() => validateFilePath(false)).toThrow('non-empty string');
    });

    it('should reject NaN', () => {
      expect(() => validateFilePath(NaN)).toThrow('non-empty string');
    });
  });

  describe('type assertion', () => {
    it('should allow string operations after validation', () => {
      const path: unknown = '/home/user/file.sql';
      validateFilePath(path);
      // TypeScript should now know path is a string
      expect(path.length).toBeGreaterThan(0);
      expect(path.endsWith('.sql')).toBe(true);
    });
  });
});
