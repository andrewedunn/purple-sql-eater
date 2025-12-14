// ABOUTME: File browser component for workspace navigation and file management.
// ABOUTME: Displays file tree with expand/collapse, handles file operations, and workspace selection.

import { useState, useEffect, useMemo } from 'react';
import type { FileNode, FileTree, FileSearchResult } from '../../shared/types';
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
  const [searchMode, setSearchMode] = useState<'filename' | 'content'>('filename');
  const [contentSearchResults, setContentSearchResults] = useState<FileSearchResult[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
  } | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState<FileNode | null>(null);
  const [showNewFileDialog, setShowNewFileDialog] = useState<string | null>(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState<string | null>(null);
  const [dialogValue, setDialogValue] = useState('');

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

  // Close context menu on click away
  useEffect(() => {
    if (contextMenu) {
      const handleClickAway = () => setContextMenu(null);
      document.addEventListener('click', handleClickAway);
      return () => document.removeEventListener('click', handleClickAway);
    }
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      node,
    });
  };

  const handleNewFile = async () => {
    if (!showNewFileDialog) return;
    if (!dialogValue.trim()) {
      setShowNewFileDialog(null);
      setDialogValue('');
      return;
    }

    try {
      const filePath = `${showNewFileDialog}/${dialogValue}`;
      await window.electron.fileCreate(filePath);
      await loadFileTree();
      setShowNewFileDialog(null);
      setDialogValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
    }
  };

  const handleNewFolder = async () => {
    if (!showNewFolderDialog) return;
    if (!dialogValue.trim()) {
      setShowNewFolderDialog(null);
      setDialogValue('');
      return;
    }

    try {
      const folderPath = `${showNewFolderDialog}/${dialogValue}`;
      await window.electron.folderCreate(folderPath);
      await loadFileTree();
      setShowNewFolderDialog(null);
      setDialogValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    }
  };

  const handleRename = async () => {
    if (!showRenameDialog) return;
    if (!dialogValue.trim()) {
      setShowRenameDialog(null);
      setDialogValue('');
      return;
    }

    try {
      const oldPath = showRenameDialog.path;
      const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = `${parentPath}/${dialogValue}`;

      if (showRenameDialog.type === 'file') {
        await window.electron.fileRename(oldPath, newPath);
      } else {
        await window.electron.folderRename(oldPath, newPath);
      }

      await loadFileTree();
      setShowRenameDialog(null);
      setDialogValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    }
  };

  const handleDelete = async (node: FileNode) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${node.name}"?${
        node.type === 'folder' ? ' This will delete all contents.' : ''
      }`
    );

    if (!confirmed) return;

    try {
      if (node.type === 'file') {
        await window.electron.fileDelete(node.path);
      } else {
        await window.electron.folderDelete(node.path);
      }
      await loadFileTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
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
    if (searchQuery.trim() && fileTree && searchMode === 'filename') {
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
  }, [searchQuery, filteredNodes, searchMode]);

  // Perform content search when in content mode
  useEffect(() => {
    if (searchMode === 'content' && searchQuery.trim() && workspace) {
      const searchContent = async () => {
        setIsLoading(true);
        try {
          const results = await window.electron.fileSearch(searchQuery, {
            searchContent: true,
            searchFilenames: false,
            caseSensitive: false,
            maxResults: 100,
          });
          setContentSearchResults(results);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setContentSearchResults([]);
        } finally {
          setIsLoading(false);
        }
      };

      const debounce = setTimeout(searchContent, 300);
      return () => clearTimeout(debounce);
    } else if (searchMode === 'content' && !searchQuery.trim()) {
      setContentSearchResults([]);
    }
  }, [searchQuery, searchMode, workspace]);

  const renderContentSearchResult = (result: FileSearchResult): JSX.Element => {
    const fileName = result.path.split('/').pop() || result.name;
    const extension = fileName.includes('.') ? `.${fileName.split('.').pop()}` : '';
    const isSql = extension === '.sql';

    return (
      <div key={result.path} className="search-result-item">
        <div
          className="search-result-file"
          onClick={() => handleFileClick(result.path)}
        >
          <span className={`file-icon ${isSql ? 'sql' : ''}`}>📄</span>
          <span className="file-name">{fileName}</span>
          <span className="file-score">{result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}</span>
        </div>
        <div className="search-result-matches">
          {result.matches.slice(0, 3).map((match, idx) => (
            <div key={idx} className="search-match">
              <span className="match-line">Line {match.lineNumber}:</span>
              <span className="match-text">{match.line.trim()}</span>
            </div>
          ))}
          {result.matches.length > 3 && (
            <div className="search-match-more">
              +{result.matches.length - 3} more match{result.matches.length - 3 !== 1 ? 'es' : ''}
            </div>
          )}
        </div>
      </div>
    );
  };

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
            onContextMenu={(e) => handleContextMenu(e, node)}
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
        onContextMenu={(e) => handleContextMenu(e, node)}
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
              <div className="search-container">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder={searchMode === 'filename' ? 'Search files...' : 'Search content...'}
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
                <div className="search-mode-toggle">
                  <button
                    className={searchMode === 'filename' ? 'active' : ''}
                    onClick={() => setSearchMode('filename')}
                    title="Search by filename"
                  >
                    Name
                  </button>
                  <button
                    className={searchMode === 'content' ? 'active' : ''}
                    onClick={() => setSearchMode('content')}
                    title="Search file contents"
                  >
                    Content
                  </button>
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              {isLoading ? (
                <div className="loading">
                  {searchMode === 'content' ? 'Searching content...' : 'Loading files...'}
                </div>
              ) : searchMode === 'content' && searchQuery ? (
                <div className="search-results">
                  {contentSearchResults.length === 0 ? (
                    <div className="empty-results">No matches found</div>
                  ) : (
                    contentSearchResults.map(renderContentSearchResult)
                  )}
                </div>
              ) : (
                <div
                  className="file-tree"
                  onContextMenu={(e) => handleContextMenu(e, null)}
                >
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.node?.type === 'folder' && (
            <>
              <button
                onClick={() => {
                  setShowNewFileDialog(contextMenu.node!.path);
                  setDialogValue('');
                  setContextMenu(null);
                }}
              >
                New File
              </button>
              <button
                onClick={() => {
                  setShowNewFolderDialog(contextMenu.node!.path);
                  setDialogValue('');
                  setContextMenu(null);
                }}
              >
                New Folder
              </button>
            </>
          )}
          {!contextMenu.node && workspace && (
            <>
              <button
                onClick={() => {
                  setShowNewFileDialog(workspace);
                  setDialogValue('');
                  setContextMenu(null);
                }}
              >
                New File
              </button>
              <button
                onClick={() => {
                  setShowNewFolderDialog(workspace);
                  setDialogValue('');
                  setContextMenu(null);
                }}
              >
                New Folder
              </button>
            </>
          )}
          {contextMenu.node && (
            <>
              <button
                onClick={() => {
                  setShowRenameDialog(contextMenu.node!);
                  setDialogValue(contextMenu.node!.name);
                  setContextMenu(null);
                }}
              >
                Rename
              </button>
              <button
                onClick={() => {
                  handleDelete(contextMenu.node!);
                  setContextMenu(null);
                }}
                className="danger"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3>Rename {showRenameDialog.type === 'file' ? 'File' : 'Folder'}</h3>
            <input
              type="text"
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setShowRenameDialog(null);
                  setDialogValue('');
                }
              }}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={() => {
                setShowRenameDialog(null);
                setDialogValue('');
              }}>
                Cancel
              </button>
              <button onClick={handleRename} className="primary">
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New File Dialog */}
      {showNewFileDialog && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3>New File</h3>
            <input
              type="text"
              placeholder="filename.sql"
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewFile();
                if (e.key === 'Escape') {
                  setShowNewFileDialog(null);
                  setDialogValue('');
                }
              }}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={() => {
                setShowNewFileDialog(null);
                setDialogValue('');
              }}>
                Cancel
              </button>
              <button onClick={handleNewFile} className="primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3>New Folder</h3>
            <input
              type="text"
              placeholder="folder-name"
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNewFolder();
                if (e.key === 'Escape') {
                  setShowNewFolderDialog(null);
                  setDialogValue('');
                }
              }}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={() => {
                setShowNewFolderDialog(null);
                setDialogValue('');
              }}>
                Cancel
              </button>
              <button onClick={handleNewFolder} className="primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
