// ABOUTME: Workspace management service for selecting folders and managing workspace settings.
// ABOUTME: Handles workspace selection, directory tree building, and file search functionality.

import { dialog, app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { FileNode, FileTree, SearchOptions, FileSearchResult, ValidationResult, WorkspaceSettings } from '../../shared/types';
import { FileSystemService } from './FileSystemService';

export class WorkspaceService {
  private fileSystem: FileSystemService;
  private settings: WorkspaceSettings | null = null;
  private settingsPath: string;

  constructor(fileSystem: FileSystemService) {
    this.fileSystem = fileSystem;
    this.settingsPath = path.join(app.getPath('userData'), 'workspace-settings.json');
    this.loadSettings();
  }

  private async loadSettings(): Promise<void> {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      this.settings = JSON.parse(data);
    } catch {
      // No settings file yet, start with defaults
      this.settings = null;
    }
  }

  private async saveSettings(): Promise<void> {
    if (this.settings) {
      await fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2));
    }
  }

  async selectWorkspaceFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Select Workspace Folder',
      properties: ['openDirectory', 'createDirectory'],
      message: 'Choose a folder to use as your SQL workspace',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }

  async setWorkspaceFolder(folderPath: string): Promise<void> {
    // Validate the path first
    const validation = await this.validateWorkspacePath(folderPath);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid workspace path');
    }

    // Update settings
    this.settings = {
      path: folderPath,
      lastOpened: new Date(),
      recentFiles: this.settings?.recentFiles || [],
      ignoredPatterns: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.DS_Store',
        '**/Thumbs.db',
      ],
      autoSave: false,
      autoSaveInterval: 30000, // 30 seconds
    };

    await this.saveSettings();
  }

  getWorkspaceFolder(): string | null {
    return this.settings?.path || null;
  }

  async validateWorkspacePath(folderPath: string): Promise<ValidationResult> {
    const result: ValidationResult = { isValid: true, warnings: [] };

    try {
      const stats = await fs.stat(folderPath);

      if (!stats.isDirectory()) {
        return { isValid: false, error: 'Selected path is not a folder' };
      }

      const permissions = await this.fileSystem.checkPermissions(folderPath);
      if (!permissions.canRead) {
        return { isValid: false, error: 'Cannot read this folder. Check permissions.' };
      }

      if (!permissions.canWrite) {
        result.warnings!.push('Folder is read-only. You will not be able to create or modify files.');
      }

      // Count files (with limit to prevent hanging)
      const fileCount = await this.countFiles(folderPath, 10000);
      if (fileCount >= 10000) {
        result.warnings!.push(
          'This folder contains 10,000+ files. Performance may be affected. Consider using a smaller workspace.'
        );
      } else if (fileCount > 1000) {
        result.warnings!.push(
          `This folder contains ${fileCount} files. Large workspaces may be slower to load.`
        );
      }

      return result;
    } catch (err: any) {
      return { isValid: false, error: err.message };
    }
  }

  private async countFiles(dirPath: string, limit: number, current: number = 0): Promise<number> {
    if (current >= limit) return current;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      let count = current;

      for (const entry of entries) {
        if (count >= limit) break;

        const fullPath = path.join(dirPath, entry.name);

        // Skip ignored patterns
        if (this.shouldIgnore(fullPath)) continue;

        if (entry.isDirectory()) {
          count = await this.countFiles(fullPath, limit, count);
        } else {
          count++;
        }
      }

      return count;
    } catch {
      return current;
    }
  }

  private shouldIgnore(filePath: string): boolean {
    const patterns = this.settings?.ignoredPatterns || [];
    const fileName = path.basename(filePath);

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
        if (regex.test(filePath)) return true;
      } else if (filePath.includes(pattern.replace(/\*\*/g, ''))) {
        return true;
      }
    }

    return fileName.startsWith('.');
  }

  async getDirectoryTree(dirPath: string): Promise<FileTree> {
    const nodes = await this.fileSystem.listDirectory(dirPath);
    let totalFiles = 0;
    let totalFolders = 0;

    // Filter out ignored files
    const filteredNodes = nodes.filter(node => !this.shouldIgnore(node.path));

    // Count totals
    for (const node of filteredNodes) {
      if (node.type === 'file') {
        totalFiles++;
      } else {
        totalFolders++;
      }
    }

    return {
      root: dirPath,
      nodes: filteredNodes,
      totalFiles,
      totalFolders,
    };
  }

  async searchFiles(query: string, options: SearchOptions): Promise<FileSearchResult[]> {
    const workspacePath = this.getWorkspaceFolder();
    if (!workspacePath) {
      throw new Error('No workspace selected');
    }

    const results: FileSearchResult[] = [];
    const maxResults = options.maxResults || 100;

    await this.searchDirectory(workspacePath, query, options, results, maxResults);

    // Sort by score (higher is better)
    return results.sort((a, b) => b.score - a.score);
  }

  private async searchDirectory(
    dirPath: string,
    query: string,
    options: SearchOptions,
    results: FileSearchResult[],
    maxResults: number
  ): Promise<void> {
    if (results.length >= maxResults) return;

    try {
      const nodes = await this.fileSystem.listDirectory(dirPath);

      for (const node of nodes) {
        if (results.length >= maxResults) break;
        if (this.shouldIgnore(node.path)) continue;

        if (node.type === 'folder') {
          // Recursively search subdirectories
          await this.searchDirectory(node.path, query, options, results, maxResults);
        } else if (node.type === 'file') {
          // Check if file matches search
          const match = await this.matchesSearch(node, query, options);
          if (match) {
            results.push(match);
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
      console.error(`Failed to search directory ${dirPath}:`, err);
    }
  }

  private async matchesSearch(
    node: FileNode,
    query: string,
    options: SearchOptions
  ): Promise<FileSearchResult | null> {
    const lowerQuery = query.toLowerCase();

    // Filename search
    if (options.mode === 'filename' || options.mode === 'content') {
      if (node.name.toLowerCase().includes(lowerQuery)) {
        return {
          path: node.path,
          name: node.name,
          matches: [],
          score: this.calculateScore(node.name, query),
        };
      }
    }

    // Content search
    if (options.mode === 'content') {
      try {
        const content = await this.fileSystem.readFile(node.path);
        const lines = content.split('\n');
        const matches = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const index = line.toLowerCase().indexOf(lowerQuery);

          if (index !== -1) {
            matches.push({
              line: i + 1,
              column: index,
              text: line.trim(),
              matchStart: index,
              matchEnd: index + query.length,
            });

            // Limit to 10 matches per file
            if (matches.length >= 10) break;
          }
        }

        if (matches.length > 0) {
          return {
            path: node.path,
            name: node.name,
            matches,
            score: this.calculateScore(node.name, query) + matches.length,
          };
        }
      } catch {
        // Can't read file content (binary file, permission denied, etc.)
        return null;
      }
    }

    return null;
  }

  private calculateScore(name: string, query: string): number {
    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Exact match
    if (lowerName === lowerQuery) return 1000;

    // Starts with query
    if (lowerName.startsWith(lowerQuery)) return 500;

    // Contains query
    if (lowerName.includes(lowerQuery)) {
      // Prefer shorter names
      return 100 / name.length;
    }

    return 0;
  }

  addRecentFile(filePath: string): void {
    if (!this.settings) return;

    // Remove if already in list
    this.settings.recentFiles = this.settings.recentFiles.filter(f => f !== filePath);

    // Add to front
    this.settings.recentFiles.unshift(filePath);

    // Keep only last 20
    this.settings.recentFiles = this.settings.recentFiles.slice(0, 20);

    this.saveSettings();
  }

  getRecentFiles(): string[] {
    return this.settings?.recentFiles || [];
  }
}
