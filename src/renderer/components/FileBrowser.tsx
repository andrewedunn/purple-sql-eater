// ABOUTME: File browser component for workspace navigation and file management.
// ABOUTME: Displays file tree with expand/collapse, handles file operations, and workspace selection.

import { useState, useEffect, useMemo } from 'react';
import type { FileNode, FileTree } from '../../shared/types';
import './FileBrowser.css';

interface FileBrowserProps {
  isVisible: boolean;
  onToggle: () => void;
  onFileOpen: (filePath: string) => void;
  connectionId?: string; // Used to clear on connection change
}

export function FileBrowser({
  isVisible,
  onToggle,
  onFileOpen,
  connectionId,
}: FileBrowserProps) {
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTree | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load workspace on mount
  useEffect(() => {
    loadWorkspace();
  }, []);

  // Reload file tree when workspace changes
  useEffect(() => {
    if (workspace) {
      loadFileTree();
    }
  }, [workspace]);

  const loadWorkspace = async () => {
    try {
      const savedWorkspace = await window.electron.workspaceGet();
      if (savedWorkspace) {
        setWorkspace(savedWorkspace);
      }
    } catch (err) {
      console.error('Failed to load workspace:', err);
    }
  };

  const loadFileTree = async () => {
    if (!workspace) return;

    setIsLoading(true);
    setError(null);
    try {
      const tree = await window.electron.workspaceGetTree(workspace);
      setFileTree(tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file tree');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectWorkspace = async () => {
    try {
      const folderPath = await window.electron.workspaceSelect();
      if (folderPath) {
        await window.electron.workspaceSet(folderPath);
        setWorkspace(folderPath);
        setExpandedFolders(new Set());
        setSearchQuery('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select workspace');
    }
  };

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = (filePath: string) => {
    onFileOpen(filePath);
  };

  // Filter files based on search query
  const filteredNodes = useMemo(() => {
    if (!fileTree || !searchQuery.trim()) {
      return fileTree?.nodes || [];
    }

    const query = searchQuery.toLowerCase();
    const filterNode = (node: FileNode): FileNode | null => {
      const nameMatch = node.name.toLowerCase().includes(query);

      if (node.type === 'file') {
        return nameMatch ? node : null;
      }

      // For folders, recursively filter children
      const filteredChildren = node.children
        ?.map(filterNode)
        .filter((n): n is FileNode => n !== null) || [];

      // Include folder if it matches or has matching children
      if (nameMatch || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }

      return null;
    };

    return fileTree.nodes
      .map(filterNode)
      .filter((n): n is FileNode => n !== null);
  }, [fileTree, searchQuery]);

  // Auto-expand folders when searching
  useEffect(() => {
    if (searchQuery.trim() && fileTree) {
      const allFolders = new Set<string>();
      const collectFolders = (nodes: FileNode[]) => {
        nodes.forEach((node) => {
          if (node.type === 'folder') {
            allFolders.add(node.path);
            if (node.children) {
              collectFolders(node.children);
            }
          }
        });
      };
      collectFolders(filteredNodes);
      setExpandedFolders(allFolders);
    }
  }, [searchQuery, filteredNodes]);

  const renderFileNode = (node: FileNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children && node.children.length > 0;

    if (node.type === 'folder') {
      return (
        <div key={node.path} className="file-tree-node">
          <div
            className="file-tree-item folder"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => toggleFolder(node.path)}
          >
            <span className="folder-icon">{isExpanded ? '▼' : '▶'}</span>
            <span className="folder-name">{node.name}</span>
            {hasChildren && (
              <span className="folder-count">({node.children!.length})</span>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div className="file-tree-children">
              {node.children!.map((child) => renderFileNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File node
    const extension = node.extension || '';
    const isSql = extension === '.sql';

    return (
      <div
        key={node.path}
        className="file-tree-item file"
        style={{ paddingLeft: `${depth * 16 + 24}px` }}
        onClick={() => handleFileClick(node.path)}
      >
        <span className={`file-icon ${isSql ? 'sql' : ''}`}>📄</span>
        <span className="file-name">{node.name}</span>
      </div>
    );
  };

  return (
    <div className={`file-browser ${isVisible ? '' : 'collapsed'}`}>
      <div className="file-browser-header">
        <div className="file-browser-title">
          <button
            className="toggle-btn"
            onClick={onToggle}
            title={isVisible ? 'Hide files' : 'Show files'}
          >
            {isVisible ? '◀' : '▶'}
          </button>
          <span>Files</span>
        </div>
        {isVisible && (
          <button
            className="workspace-btn"
            onClick={handleSelectWorkspace}
            title="Select workspace folder"
          >
            📁
          </button>
        )}
      </div>

      {isVisible && (
        <div className="file-browser-content">
          {!workspace ? (
            <div className="empty-state">
              <p>No workspace selected</p>
              <button onClick={handleSelectWorkspace} className="btn-select-workspace">
                Select Workspace
              </button>
            </div>
          ) : (
            <>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button
                    className="search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {error && <div className="error-message">{error}</div>}

              {isLoading ? (
                <div className="loading">Loading files...</div>
              ) : (
                <div className="file-tree">
                  {filteredNodes.length === 0 ? (
                    <div className="empty-results">
                      {searchQuery ? 'No files found' : 'No files in workspace'}
                    </div>
                  ) : (
                    filteredNodes.map((node) => renderFileNode(node, 0))
                  )}
                </div>
              )}

              <div className="workspace-info">
                <div className="workspace-path" title={workspace}>
                  {workspace.split('/').pop()}
                </div>
                {fileTree && (
                  <div className="workspace-stats">
                    {fileTree.totalFiles} file{fileTree.totalFiles !== 1 ? 's' : ''}, {fileTree.totalFolders} folder{fileTree.totalFolders !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
