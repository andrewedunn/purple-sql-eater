// ABOUTME: File browser component for workspace navigation and file management.
// ABOUTME: Displays file tree with expand/collapse, handles file operations, and workspace selection.

import { useState, useEffect, useMemo } from 'react';
import type { FileNode, FileTree, FileSearchResult } from '../../shared/types';
import { LayoutMenu } from './LayoutMenu';
import './FileBrowser.css';

interface FileBrowserProps {
  isVisible: boolean;
  onToggle: () => void;
  onFileOpen: (filePath: string) => void;
  connectionId?: string; // Used to clear on connection change
  position?: 'left' | 'right';
  onPositionChange?: (position: 'left' | 'right') => void;
  showLayoutMode?: boolean;
  layoutMode?: 'stacked' | 'horizontal';
  onLayoutModeChange?: (mode: 'stacked' | 'horizontal') => void;
}

export function FileBrowser({
  isVisible,
  onToggle,
  onFileOpen,
  connectionId,
  position = 'left',
  onPositionChange,
  showLayoutMode = false,
  layoutMode = 'stacked',
  onLayoutModeChange,
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
  const [sortBy, setSortBy] = useState<'name' | 'modified' | 'created'>('modified');
  const [sortAscending, setSortAscending] = useState(false);

  // Load workspace on mount
  useEffect(() => {
    loadWorkspace();
  }, []);

  // Reload file tree when workspace changes and set up folder watching
  useEffect(() => {
    if (workspace) {
      loadFileTree();

      // Watch for changes in the workspace folder (if function exists)
      if (typeof window.electron?.folderWatch === 'function') {
        window.electron.folderWatch(workspace);
      }

      // Listen for folder-changed events
      const handleFolderChanged = (_event: any, changedPath: string) => {
        if (changedPath === workspace) {
          loadFileTree();
        }
      };

      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.on('folder-changed', handleFolderChanged);
      }

      return () => {
        if (typeof window.electron?.folderUnwatch === 'function') {
          window.electron.folderUnwatch(workspace);
        }
        if (window.electron?.ipcRenderer) {
          window.electron.ipcRenderer.removeListener('folder-changed', handleFolderChanged);
        }
      };
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

  // Filter and sort files based on search query and sort order
  const filteredNodes = useMemo(() => {
    const nodes = fileTree?.nodes || [];

    // Apply search filter
    let filtered = nodes;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filterNode = (node: FileNode): FileNode | null => {
        const nameMatch = node.name.toLowerCase().includes(query);

        if (node.type === 'file') {
          // Only show .sql files
          const isSqlFile = node.name.toLowerCase().endsWith('.sql');
          return nameMatch && isSqlFile ? node : null;
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

      filtered = nodes
        .map(filterNode)
        .filter((n): n is FileNode => n !== null);
    } else {
      // When no search query, still filter to only .sql files
      const filterNode = (node: FileNode): FileNode | null => {
        if (node.type === 'file') {
          const isSqlFile = node.name.toLowerCase().endsWith('.sql');
          return isSqlFile ? node : null;
        }

        // For folders, recursively filter children
        const filteredChildren = node.children
          ?.map(filterNode)
          .filter((n): n is FileNode => n !== null) || [];

        // Include folder if it has matching children
        if (filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }

        return null;
      };

      filtered = nodes
        .map(filterNode)
        .filter((n): n is FileNode => n !== null);
    }

    // Apply sorting to files within each folder
    const sortNodes = (nodesToSort: FileNode[]): FileNode[] => {
      const folders = nodesToSort.filter(n => n.type === 'folder');
      const files = nodesToSort.filter(n => n.type === 'file');

      // Sort files based on current sort option
      files.sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'modified') {
          const aDate = a.modified ? new Date(a.modified).getTime() : 0;
          const bDate = b.modified ? new Date(b.modified).getTime() : 0;
          comparison = bDate - aDate; // Newest first by default
        } else { // created
          const aDate = a.created ? new Date(a.created).getTime() : 0;
          const bDate = b.created ? new Date(b.created).getTime() : 0;
          comparison = bDate - aDate; // Newest first by default
        }
        return sortAscending ? -comparison : comparison;
      });

      // Folders always alphabetically
      folders.sort((a, b) => a.name.localeCompare(b.name));

      // Recursively sort children
      const sortedFolders = folders.map(folder => ({
        ...folder,
        children: folder.children ? sortNodes(folder.children) : undefined,
      }));

      return [...sortedFolders, ...files];
    };

    return sortNodes(filtered);
  }, [fileTree, searchQuery, sortBy, sortAscending]);

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
            mode: 'content',
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

    return (
      <div key={result.path} className="search-result-item">
        <div
          className="search-result-file"
          onClick={() => handleFileClick(result.path)}
        >
          <span className="file-name">{fileName}</span>
          <span className="file-score">{result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}</span>
        </div>
        <div className="search-result-matches">
          {result.matches.slice(0, 3).map((match, idx) => (
            <div key={idx} className="search-match">
              <span className="match-line">Line {match.line}:</span>
              <span className="match-text">{match.text.trim()}</span>
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
    const formatDate = (date: Date | string | undefined): string => {
      if (!date) return '-';
      // Handle dates that come as strings from IPC
      const d = typeof date === 'string' ? new Date(date) : new Date(date);
      // Check if date is valid
      if (isNaN(d.getTime())) return '-';
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Within last 24 hours - show relative time
      if (diffHours < 1) {
        return 'Just now';
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      }

      // Same year - show month and day only
      if (d.getFullYear() === now.getFullYear()) {
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }

      // Different year - include year
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Show date based on current sort mode
    const dateToShow = sortBy === 'created' ? node.created : node.modified;
    const dateLabel = sortBy === 'created' ? 'Created' : 'Modified';

    return (
      <div
        key={node.path}
        className="file-tree-item file"
        style={{ paddingLeft: `${depth * 16 + 24}px` }}
        onClick={() => handleFileClick(node.path)}
        onContextMenu={(e) => handleContextMenu(e, node)}
      >
        <span className="file-name" title={node.name}>{node.name}</span>
        <span className="file-date" title={`${dateLabel}: ${dateToShow ? new Date(dateToShow).toLocaleString() : 'Unknown'}`}>
          {formatDate(dateToShow)}
        </span>
      </div>
    );
  };

  if (!isVisible) {
    return (
      <button className="file-toggle collapsed" onClick={onToggle} title="Show files">
        📁
      </button>
    );
  }

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <h3 className="file-browser-title">Files</h3>
        <div className="file-browser-actions">
          <button
            className="workspace-btn"
            onClick={handleSelectWorkspace}
            title="Select workspace folder"
          >
            📁
          </button>
          {onPositionChange && (
            <LayoutMenu
              currentPosition={position}
              onPositionChange={onPositionChange}
              showLayoutMode={showLayoutMode}
              currentLayoutMode={layoutMode}
              onLayoutModeChange={onLayoutModeChange}
            />
          )}
          <button
            className="toggle-btn"
            onClick={onToggle}
            title="Hide files"
          >
            ◀
          </button>
        </div>
      </div>

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
              <div className="file-search">
                <input
                  type="text"
                  placeholder={searchMode === 'filename' ? 'Search files...' : 'Search content...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="search-controls">
                  <button
                    className={`search-mode-btn ${searchMode === 'filename' ? 'active' : ''}`}
                    onClick={() => setSearchMode(searchMode === 'filename' ? 'content' : 'filename')}
                    title={searchMode === 'filename' ? 'Switch to content search' : 'Switch to filename search'}
                  >
                    {searchMode === 'filename' ? '📄' : '🔍'}
                  </button>
                  {searchQuery && (
                    <button
                      className="search-clear"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
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
                <>
                  <div className="file-tree-header">
                    <button
                      className={`column-header name-column ${sortBy === 'name' ? 'active' : ''}`}
                      onClick={() => {
                        if (sortBy === 'name') {
                          setSortAscending(!sortAscending);
                        } else {
                          setSortBy('name');
                          setSortAscending(false);
                        }
                      }}
                      title="Sort by name"
                    >
                      Name
                      {sortBy === 'name' && (
                        <span className="sort-indicator">{sortAscending ? '↑' : '↓'}</span>
                      )}
                    </button>
                    <button
                      className={`column-header date-column ${sortBy !== 'name' ? 'active' : ''}`}
                      onClick={() => {
                        // Cycle through: modified -> created -> modified (with sort toggle)
                        if (sortBy === 'name') {
                          setSortBy('modified');
                          setSortAscending(false);
                        } else if (sortBy === 'modified') {
                          if (sortAscending) {
                            // Was ascending modified, switch to created
                            setSortBy('created');
                            setSortAscending(false);
                          } else {
                            // Was descending modified, toggle to ascending
                            setSortAscending(true);
                          }
                        } else {
                          // Was created, toggle or cycle back to modified
                          if (sortAscending) {
                            setSortBy('modified');
                            setSortAscending(false);
                          } else {
                            setSortAscending(true);
                          }
                        }
                      }}
                      title={`Click to cycle: ${sortBy === 'modified' ? 'Modified → Created' : 'Created → Modified'}`}
                    >
                      {sortBy === 'modified' ? 'Modified' : sortBy === 'created' ? 'Created' : 'Date'}
                      {sortBy !== 'name' && (
                        <span className="sort-indicator">{sortAscending ? '↑' : '↓'}</span>
                      )}
                    </button>
                  </div>
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
                </>
              )}

              <div className="workspace-info">
                <div className="workspace-path" title={workspace}>
                  {workspace.split('/').pop()}
                </div>
              </div>
            </>
          )}
        </div>

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
