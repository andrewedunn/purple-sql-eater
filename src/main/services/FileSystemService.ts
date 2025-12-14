// ABOUTME: File system service for reading, writing, and managing files and folders.
// ABOUTME: Handles low-level file I/O operations with error handling and validation.

import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileNode, FilePermissions, FileStats } from '../../shared/types';

export class FileSystemError extends Error {
  constructor(
    message: string,
    public code: string,
    public path: string,
    public operation: string
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

export class FileSystemService {
  private workspaceRoot: string | null = null;

  setWorkspaceRoot(rootPath: string): void {
    this.workspaceRoot = path.resolve(rootPath);
  }

  private validatePath(filePath: string): void {
    if (!this.workspaceRoot) {
      // No workspace set - allow all paths (backward compatibility)
      return;
    }

    const resolvedPath = path.resolve(filePath);
    const relativePath = path.relative(this.workspaceRoot, resolvedPath);

    // Check if path escapes workspace using path traversal
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new FileSystemError(
        `Access denied: Path outside workspace`,
        'EACCES',
        filePath,
        'validate'
      );
    }
  }

  async readFile(filePath: string): Promise<string> {
    this.validatePath(filePath);
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileSystemError(
          `File not found: ${filePath}`,
          'ENOENT',
          filePath,
          'read'
        );
      } else if (err.code === 'EACCES') {
        throw new FileSystemError(
          `Permission denied: ${filePath}`,
          'EACCES',
          filePath,
          'read'
        );
      }
      throw new FileSystemError(
        `Failed to read file: ${err.message}`,
        err.code || 'UNKNOWN',
        filePath,
        'read'
      );
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.validatePath(filePath);
    try {
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileSystemError(
          `Directory not found: ${path.dirname(filePath)}`,
          'ENOENT',
          filePath,
          'write'
        );
      } else if (err.code === 'EACCES') {
        throw new FileSystemError(
          `Permission denied: ${filePath}`,
          'EACCES',
          filePath,
          'write'
        );
      } else if (err.code === 'ENOSPC') {
        throw new FileSystemError(
          'Disk full, cannot save file',
          'ENOSPC',
          filePath,
          'write'
        );
      }
      throw new FileSystemError(
        `Failed to write file: ${err.message}`,
        err.code || 'UNKNOWN',
        filePath,
        'write'
      );
    }
  }

  async createFile(filePath: string, content: string = ''): Promise<void> {
    this.validatePath(filePath);
    try{
      await fs.writeFile(filePath, content, { flag: 'wx', encoding: 'utf-8' });
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        throw new FileSystemError(
          `File already exists: ${filePath}`,
          'EEXIST',
          filePath,
          'create'
        );
      }
      throw new FileSystemError(
        `Failed to create file: ${err.message}`,
        err.code || 'UNKNOWN',
        filePath,
        'create'
      );
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    this.validatePath(filePath);
    try {
      await fs.unlink(filePath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileSystemError(
          `File not found: ${filePath}`,
          'ENOENT',
          filePath,
          'delete'
        );
      }
      throw new FileSystemError(
        `Failed to delete file: ${err.message}`,
        err.code || 'UNKNOWN',
        filePath,
        'delete'
      );
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    this.validatePath(oldPath);
    this.validatePath(newPath);
    try {
      await fs.rename(oldPath, newPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileSystemError(
          `File not found: ${oldPath}`,
          'ENOENT',
          oldPath,
          'rename'
        );
      } else if (err.code === 'EEXIST') {
        throw new FileSystemError(
          `Target already exists: ${newPath}`,
          'EEXIST',
          newPath,
          'rename'
        );
      }
      throw new FileSystemError(
        `Failed to rename file: ${err.message}`,
        err.code || 'UNKNOWN',
        oldPath,
        'rename'
      );
    }
  }

  async createFolder(folderPath: string): Promise<void> {
    this.validatePath(folderPath);
    try {
      await fs.mkdir(folderPath, { recursive: true });
    } catch (err: any) {
      throw new FileSystemError(
        `Failed to create folder: ${err.message}`,
        err.code || 'UNKNOWN',
        folderPath,
        'create-folder'
      );
    }
  }

  async deleteFolder(folderPath: string): Promise<void> {
    this.validatePath(folderPath);
    try {
      await fs.rm(folderPath, { recursive: true });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileSystemError(
          `Folder not found: ${folderPath}`,
          'ENOENT',
          folderPath,
          'delete-folder'
        );
      }
      throw new FileSystemError(
        `Failed to delete folder: ${err.message}`,
        err.code || 'UNKNOWN',
        folderPath,
        'delete-folder'
      );
    }
  }

  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    this.validatePath(oldPath);
    this.validatePath(newPath);
    try {
      await fs.rename(oldPath, newPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileSystemError(
          `Folder not found: ${oldPath}`,
          'ENOENT',
          oldPath,
          'rename-folder'
        );
      } else if (err.code === 'ENOTEMPTY') {
        // This shouldn't happen with rename, but handle it anyway
        throw new FileSystemError(
          `Target folder not empty: ${newPath}`,
          'ENOTEMPTY',
          newPath,
          'rename-folder'
        );
      }
      throw new FileSystemError(
        `Failed to rename folder: ${err.message}`,
        err.code || 'UNKNOWN',
        oldPath,
        'rename-folder'
      );
    }
  }

  async listDirectory(dirPath: string): Promise<FileNode[]> {
    this.validatePath(dirPath);
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const nodes: FileNode[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        nodes.push({
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? 'folder' : 'file',
          extension: entry.isFile() ? path.extname(entry.name) : undefined,
          size: stats.size,
          modified: stats.mtime as any, // Electron IPC will serialize to string
          // Use birthtime (creation date) or fall back to mtime if unavailable
          created: (stats.birthtime || stats.mtime) as any, // Electron IPC will serialize to string
        });
      }

      // Sort: folders first, then alphabetically
      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new FileSystemError(
          `Directory not found: ${dirPath}`,
          'ENOENT',
          dirPath,
          'list'
        );
      } else if (err.code === 'EACCES') {
        throw new FileSystemError(
          `Permission denied: ${dirPath}`,
          'EACCES',
          dirPath,
          'list'
        );
      }
      throw new FileSystemError(
        `Failed to list directory: ${err.message}`,
        err.code || 'UNKNOWN',
        dirPath,
        'list'
      );
    }
  }

  async checkPermissions(filePath: string): Promise<FilePermissions> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
      const canRead = true;

      let canWrite = false;
      try {
        await fs.access(filePath, fs.constants.W_OK);
        canWrite = true;
      } catch {
        // Can't write
      }

      let canExecute = false;
      try {
        await fs.access(filePath, fs.constants.X_OK);
        canExecute = true;
      } catch {
        // Can't execute
      }

      return { canRead, canWrite, canExecute };
    } catch (err: any) {
      return { canRead: false, canWrite: false, canExecute: false };
    }
  }

  async getStats(filePath: string): Promise<FileStats> {
    try {
      const stats = await fs.stat(filePath);
      const permissions = await this.checkPermissions(filePath);

      return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isReadOnly: !permissions.canWrite,
      };
    } catch (err: any) {
      throw new FileSystemError(
        `Failed to get file stats: ${err.message}`,
        err.code || 'UNKNOWN',
        filePath,
        'stat'
      );
    }
  }
}
