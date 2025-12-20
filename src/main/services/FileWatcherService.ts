// ABOUTME: File watching service that detects external changes to open files and folders.
// ABOUTME: Uses chokidar to watch files/folders and send IPC notifications when changes are detected.

import { BrowserWindow } from 'electron';
import chokidar, { FSWatcher } from 'chokidar';

export class FileWatcherService {
  private watchers: Map<string, FSWatcher> = new Map();
  private folderWatchers: Map<string, FSWatcher> = new Map();
  private window: BrowserWindow | null = null;
  private suppressedPaths: Set<string> = new Set();

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  /**
   * Suppress file watcher notifications for a path.
   * Use this before making changes to a file from within the app.
   */
  suppressPath(filePath: string): void {
    this.suppressedPaths.add(filePath);
  }

  /**
   * Re-enable notifications for a path after suppression.
   */
  unsuppressPath(filePath: string): void {
    this.suppressedPaths.delete(filePath);
  }

  /**
   * Check if a path is currently suppressed.
   */
  isPathSuppressed(filePath: string): boolean {
    return this.suppressedPaths.has(filePath);
  }

  /**
   * Update a watched file path (used when renaming).
   * Transfers the watcher from oldPath to newPath without triggering events.
   */
  updateWatchedPath(oldPath: string, newPath: string): void {
    const watcher = this.watchers.get(oldPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(oldPath);
      // Start watching the new path
      this.watchFile(newPath);
    }
  }

  watchFile(filePath: string): void {
    if (this.watchers.has(filePath)) {
      return; // Already watching
    }

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    watcher.on('change', () => {
      const isSuppressed = this.isPathSuppressed(filePath);
      console.log(`[FileWatcher] Change detected: ${filePath}, suppressed: ${isSuppressed}`);
      if (this.window && !isSuppressed) {
        this.window.webContents.send('file-changed', filePath);
      }
    });

    watcher.on('unlink', () => {
      if (this.window && !this.isPathSuppressed(filePath)) {
        this.window.webContents.send('file-deleted', filePath);
      }
      this.unwatchFile(filePath);
    });

    watcher.on('error', (error) => {
      console.error(`[FileWatcher] Error watching file ${filePath}:`, error);
      this.unwatchFile(filePath);
    });

    this.watchers.set(filePath, watcher);
  }

  unwatchFile(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }

  watchFolder(folderPath: string): void {
    if (this.folderWatchers.has(folderPath)) {
      return; // Already watching
    }

    const watcher = chokidar.watch(folderPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 10, // Watch nested folders
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    // Debounce folder changes to avoid rapid-fire updates
    let debounceTimer: NodeJS.Timeout | null = null;
    const notifyChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (this.window) {
          this.window.webContents.send('folder-changed', folderPath);
        }
      }, 300);
    };

    watcher.on('add', notifyChange);
    watcher.on('unlink', notifyChange);
    watcher.on('addDir', notifyChange);
    watcher.on('unlinkDir', notifyChange);

    watcher.on('error', (error) => {
      console.error(`[FileWatcher] Error watching folder ${folderPath}:`, error);
      this.unwatchFolder(folderPath);
    });

    this.folderWatchers.set(folderPath, watcher);
  }

  unwatchFolder(folderPath: string): void {
    const watcher = this.folderWatchers.get(folderPath);
    if (watcher) {
      watcher.close();
      this.folderWatchers.delete(folderPath);
    }
  }

  unwatchAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    for (const watcher of this.folderWatchers.values()) {
      watcher.close();
    }
    this.folderWatchers.clear();
  }

  getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  getWatchedFolders(): string[] {
    return Array.from(this.folderWatchers.keys());
  }
}
