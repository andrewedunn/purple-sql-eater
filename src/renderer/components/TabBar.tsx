// ABOUTME: Tabbed interface for managing multiple SQL queries.
// ABOUTME: Each tab has its own editor and results, but shares the active connection.

import { useState } from 'react';
import type { QueryResult } from '../../shared/types';
import './TabBar.css';

export interface Tab {
  id: string;
  title: string;
  sql: string;
  results: QueryResult | null;
  filePath?: string;
  isDirty?: boolean;
  isUntitled?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabAdd: () => void;
  onTabRename: (tabId: string, newTitle: string) => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabAdd,
  onTabRename,
}: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const handleDoubleClick = (tab: Tab) => {
    setEditingTabId(tab.id);
    setEditTitle(tab.title);
  };

  const handleBlur = () => {
    if (editingTabId && editTitle.trim()) {
      onTabRename(editingTabId, editTitle.trim());
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  return (
    <div className="tab-bar">
      <div className="tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {editingTabId === tab.id ? (
              <input
                className="tab-title-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : (
              <span
                className="tab-title"
                onDoubleClick={() => handleDoubleClick(tab)}
              >
                {tab.isDirty && <span className="tab-dirty">•</span>}
                {tab.title}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                title="Close tab"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="tab-add" onClick={onTabAdd} title="New tab (Cmd+T)">
          +
        </button>
      </div>
    </div>
  );
}
