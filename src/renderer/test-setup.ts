// ABOUTME: Test setup file that configures jsdom and testing-library matchers.
// ABOUTME: Provides mocks for Electron IPC and browser APIs.

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electron IPC bridge
const mockElectron = {
  // Database operations
  executeQuery: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getSchema: vi.fn(),
  getColumns: vi.fn(),

  // File operations
  workspaceSelect: vi.fn(),
  workspaceSet: vi.fn(),
  workspaceGet: vi.fn(),
  workspaceGetTree: vi.fn(),
  fileRead: vi.fn(),
  fileWrite: vi.fn(),
  fileCreate: vi.fn(),
  fileDelete: vi.fn(),
  fileRename: vi.fn(),
  folderCreate: vi.fn(),
  folderDelete: vi.fn(),
  folderRename: vi.fn(),
  folderList: vi.fn(),
  fileSearch: vi.fn(),
  fileSaveDialog: vi.fn(),
  recentFilesAdd: vi.fn(),
  recentFilesGet: vi.fn(),
  fileWatch: vi.fn(),
  fileUnwatch: vi.fn(),
  folderWatch: vi.fn(),
  folderUnwatch: vi.fn(),

  // Connections
  connectionsLoadList: vi.fn(),
  connectionsSave: vi.fn(),
  connectionsDelete: vi.fn(),
  connectionsGet: vi.fn(),
  connectionsConnect: vi.fn(),

  // Event listeners
  on: vi.fn(),
  off: vi.fn(),
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
