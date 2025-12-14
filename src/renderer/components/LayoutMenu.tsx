// ABOUTME: Layout configuration menu for positioning and arranging browser panels.
// ABOUTME: Provides dropdown menu for side selection and layout mode when applicable.

import { useState, useRef, useEffect } from 'react';
import './LayoutMenu.css';

interface LayoutMenuProps {
  currentPosition: 'left' | 'right';
  onPositionChange: (position: 'left' | 'right') => void;
  showLayoutMode: boolean;
  currentLayoutMode?: 'stacked' | 'horizontal';
  onLayoutModeChange?: (mode: 'stacked' | 'horizontal') => void;
}

export function LayoutMenu({
  currentPosition,
  onPositionChange,
  showLayoutMode,
  currentLayoutMode,
  onLayoutModeChange,
}: LayoutMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="layout-menu" ref={menuRef}>
      <button
        className="layout-menu-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Layout options"
      >
        ⋮
      </button>
      {isOpen && (
        <div className="layout-menu-dropdown">
          <div className="layout-menu-section">
            <div className="layout-menu-label">Position</div>
            <button
              className={`layout-menu-item ${currentPosition === 'left' ? 'active' : ''}`}
              onClick={() => {
                onPositionChange('left');
                setIsOpen(false);
              }}
            >
              <span className="menu-radio">{currentPosition === 'left' ? '●' : '○'}</span>
              Left Side
            </button>
            <button
              className={`layout-menu-item ${currentPosition === 'right' ? 'active' : ''}`}
              onClick={() => {
                onPositionChange('right');
                setIsOpen(false);
              }}
            >
              <span className="menu-radio">{currentPosition === 'right' ? '●' : '○'}</span>
              Right Side
            </button>
          </div>
          {showLayoutMode && onLayoutModeChange && currentLayoutMode && (
            <>
              <div className="layout-menu-divider"></div>
              <div className="layout-menu-section">
                <div className="layout-menu-label">Arrangement</div>
                <button
                  className={`layout-menu-item ${currentLayoutMode === 'stacked' ? 'active' : ''}`}
                  onClick={() => {
                    onLayoutModeChange('stacked');
                    setIsOpen(false);
                  }}
                >
                  <span className="menu-icon">⬍</span>
                  Stack Vertically
                </button>
                <button
                  className={`layout-menu-item ${currentLayoutMode === 'horizontal' ? 'active' : ''}`}
                  onClick={() => {
                    onLayoutModeChange('horizontal');
                    setIsOpen(false);
                  }}
                >
                  <span className="menu-icon">⬌</span>
                  Side by Side
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
