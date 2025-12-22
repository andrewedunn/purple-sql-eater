// ABOUTME: Tests for FileSystemService path validation and file operations.
// ABOUTME: Critical security tests that verify path traversal protection works correctly.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileSystemService, FileSystemError } from './FileSystemService';

describe('FileSystemService', () => {
  let service: FileSystemService;
  let tempDir: string;

  beforeEach(async () => {
    service = new FileSystemService();
    // Create a real temp directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pse-test-'));
    service.setWorkspaceRoot(tempDir);
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('validatePath - path traversal protection', () => {
    it('should reject paths with .. that escape workspace', async () => {
      const maliciousPath = path.join(tempDir, '..', 'etc', 'passwd');
      await expect(service.readFile(maliciousPath)).rejects.toThrow('Access denied');
    });

    it('should reject paths that resolve outside workspace', async () => {
      const outsidePath = '/etc/passwd';
      await expect(service.readFile(outsidePath)).rejects.toThrow('Access denied');
    });

    it('should reject absolute paths outside workspace', async () => {
      const outsidePath = '/tmp/some-other-file.txt';
      await expect(service.readFile(outsidePath)).rejects.toThrow('Access denied');
    });

    it('should reject paths with multiple .. sequences', async () => {
      const maliciousPath = path.join(tempDir, 'subdir', '..', '..', 'etc', 'passwd');
      await expect(service.readFile(maliciousPath)).rejects.toThrow('Access denied');
    });

    it('should allow valid paths within workspace', async () => {
      const testFile = path.join(tempDir, 'test.sql');
      await fs.writeFile(testFile, 'SELECT 1;');
      const content = await service.readFile(testFile);
      expect(content).toBe('SELECT 1;');
    });

    it('should allow nested directories within workspace', async () => {
      const nestedDir = path.join(tempDir, 'subdir', 'nested');
      await fs.mkdir(nestedDir, { recursive: true });
      const testFile = path.join(nestedDir, 'test.sql');
      await fs.writeFile(testFile, 'SELECT 2;');
      const content = await service.readFile(testFile);
      expect(content).toBe('SELECT 2;');
    });

    it('should throw EWORKSPACE when no workspace is set', async () => {
      const newService = new FileSystemService();
      // Do NOT set workspace root
      await expect(newService.readFile('/any/path')).rejects.toMatchObject({
        code: 'EWORKSPACE',
      });
    });

    it('should throw descriptive error when no workspace is set', async () => {
      const newService = new FileSystemService();
      await expect(newService.readFile('/any/path')).rejects.toThrow(
        'No workspace folder selected'
      );
    });

    it('should reject paths that look like workspace but are not (partial match)', async () => {
      // If workspace is /tmp/workspace, should reject /tmp/workspace-evil
      const evilPath = tempDir + '-evil/secret.txt';
      await expect(service.readFile(evilPath)).rejects.toThrow('Access denied');
    });
  });

  describe('readFile', () => {
    it('should read files correctly', async () => {
      const testFile = path.join(tempDir, 'read-test.sql');
      await fs.writeFile(testFile, 'SELECT * FROM users;');
      const content = await service.readFile(testFile);
      expect(content).toBe('SELECT * FROM users;');
    });

    it('should throw ENOENT for non-existent file', async () => {
      await expect(
        service.readFile(path.join(tempDir, 'nonexistent.sql'))
      ).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });

    it('should include operation type in error', async () => {
      try {
        await service.readFile(path.join(tempDir, 'nonexistent.sql'));
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as FileSystemError).operation).toBe('read');
      }
    });
  });

  describe('writeFile', () => {
    it('should write files correctly', async () => {
      const testFile = path.join(tempDir, 'write-test.sql');
      await service.writeFile(testFile, 'INSERT INTO test VALUES (1);');
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('INSERT INTO test VALUES (1);');
    });

    it('should overwrite existing files', async () => {
      const testFile = path.join(tempDir, 'overwrite-test.sql');
      await fs.writeFile(testFile, 'old content');
      await service.writeFile(testFile, 'new content');
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('new content');
    });

    it('should include operation type in error', async () => {
      const nonExistentDir = path.join(tempDir, 'no-such-dir', 'file.sql');
      try {
        await service.writeFile(nonExistentDir, 'content');
        expect.fail('Should have thrown');
      } catch (err) {
        expect((err as FileSystemError).operation).toBe('write');
      }
    });
  });

  describe('createFile', () => {
    it('should create new files', async () => {
      const testFile = path.join(tempDir, 'create-test.sql');
      await service.createFile(testFile, 'initial content');
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('initial content');
    });

    it('should create empty files when no content provided', async () => {
      const testFile = path.join(tempDir, 'empty-test.sql');
      await service.createFile(testFile);
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('');
    });

    it('should throw EEXIST when file already exists', async () => {
      const testFile = path.join(tempDir, 'exists-test.sql');
      await fs.writeFile(testFile, 'existing');
      await expect(service.createFile(testFile, 'new content')).rejects.toMatchObject({
        code: 'EEXIST',
      });
    });

    it('should not overwrite existing files', async () => {
      const testFile = path.join(tempDir, 'no-overwrite-test.sql');
      await fs.writeFile(testFile, 'original');
      try {
        await service.createFile(testFile, 'new');
      } catch {
        // Expected
      }
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('original');
    });
  });

  describe('deleteFile', () => {
    it('should delete files', async () => {
      const testFile = path.join(tempDir, 'delete-test.sql');
      await fs.writeFile(testFile, 'temp');
      await service.deleteFile(testFile);
      await expect(fs.access(testFile)).rejects.toThrow();
    });

    it('should throw ENOENT for non-existent file', async () => {
      await expect(
        service.deleteFile(path.join(tempDir, 'nonexistent.sql'))
      ).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });
  });

  describe('renameFile', () => {
    it('should rename files', async () => {
      const oldPath = path.join(tempDir, 'old-name.sql');
      const newPath = path.join(tempDir, 'new-name.sql');
      await fs.writeFile(oldPath, 'content');
      await service.renameFile(oldPath, newPath);
      await expect(fs.access(oldPath)).rejects.toThrow();
      const content = await fs.readFile(newPath, 'utf-8');
      expect(content).toBe('content');
    });

    it('should validate both old and new paths', async () => {
      const oldPath = path.join(tempDir, 'file.sql');
      const newPath = '/etc/evil.sql';
      await fs.writeFile(oldPath, 'content');
      await expect(service.renameFile(oldPath, newPath)).rejects.toThrow('Access denied');
    });

    it('should throw ENOENT for non-existent source', async () => {
      await expect(
        service.renameFile(
          path.join(tempDir, 'nonexistent.sql'),
          path.join(tempDir, 'new.sql')
        )
      ).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });
  });

  describe('folder operations', () => {
    it('should create folders', async () => {
      const folderPath = path.join(tempDir, 'new-folder');
      await service.createFolder(folderPath);
      const stat = await fs.stat(folderPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create nested folders', async () => {
      const folderPath = path.join(tempDir, 'a', 'b', 'c');
      await service.createFolder(folderPath);
      const stat = await fs.stat(folderPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should delete folders recursively', async () => {
      const folderPath = path.join(tempDir, 'to-delete');
      await fs.mkdir(folderPath);
      await fs.writeFile(path.join(folderPath, 'file.txt'), 'test');
      await service.deleteFolder(folderPath);
      await expect(fs.access(folderPath)).rejects.toThrow();
    });

    it('should rename folders', async () => {
      const oldPath = path.join(tempDir, 'old-folder');
      const newPath = path.join(tempDir, 'new-folder');
      await fs.mkdir(oldPath);
      await service.renameFolder(oldPath, newPath);
      await expect(fs.access(oldPath)).rejects.toThrow();
      const stat = await fs.stat(newPath);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('listDirectory', () => {
    it('should list directory contents', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.sql'), '');
      await fs.writeFile(path.join(tempDir, 'file2.sql'), '');
      await fs.mkdir(path.join(tempDir, 'subdir'));

      const nodes = await service.listDirectory(tempDir);
      expect(nodes).toHaveLength(3);
    });

    it('should sort folders before files', async () => {
      await fs.writeFile(path.join(tempDir, 'aaa-file.sql'), '');
      await fs.mkdir(path.join(tempDir, 'zzz-folder'));

      const nodes = await service.listDirectory(tempDir);
      expect(nodes[0].name).toBe('zzz-folder');
      expect(nodes[0].type).toBe('folder');
      expect(nodes[1].name).toBe('aaa-file.sql');
      expect(nodes[1].type).toBe('file');
    });

    it('should sort alphabetically within type', async () => {
      await fs.writeFile(path.join(tempDir, 'charlie.sql'), '');
      await fs.writeFile(path.join(tempDir, 'alpha.sql'), '');
      await fs.writeFile(path.join(tempDir, 'bravo.sql'), '');

      const nodes = await service.listDirectory(tempDir);
      expect(nodes.map((n) => n.name)).toEqual(['alpha.sql', 'bravo.sql', 'charlie.sql']);
    });

    it('should include file metadata', async () => {
      await fs.writeFile(path.join(tempDir, 'test.sql'), 'SELECT 1;');

      const nodes = await service.listDirectory(tempDir);
      const file = nodes[0];
      expect(file.extension).toBe('.sql');
      expect(file.size).toBe(9);
      expect(file.modified).toBeInstanceOf(Date);
      expect(file.created).toBeInstanceOf(Date);
    });
  });

  describe('error handling', () => {
    it('should not expose full system path in error messages', async () => {
      try {
        await service.readFile(path.join(tempDir, 'nonexistent.sql'));
      } catch (err) {
        // Error message should contain relative path, not full system path
        expect((err as FileSystemError).message).toContain('nonexistent.sql');
        expect((err as FileSystemError).message).not.toContain(os.tmpdir());
      }
    });

    it('should sanitize paths outside workspace in error messages', async () => {
      // Access denied errors should not reveal the attempted escape path
      try {
        await service.readFile('/etc/passwd');
      } catch (err) {
        expect((err as FileSystemError).message).toBe(
          'Access denied: Cannot access files outside workspace folder'
        );
      }
    });
  });
});
