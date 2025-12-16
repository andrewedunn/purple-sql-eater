// ABOUTME: Dropdown menu for column filtering in the results table.
// ABOUTME: Uses portal to escape overflow:hidden containers, with keyboard-first design.

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { ColumnFilter, FilterOperator } from '../../shared/types';
import './ColumnFilterMenu.css';

interface ColumnFilterMenuProps {
  columnIndex: number;
  columnName: string;
  columnType: 'text' | 'number';
  currentFilter?: ColumnFilter;
  onApplyFilter: (filter: ColumnFilter) => void;
  onClearFilter: () => void;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
}

interface OperatorOption {
  value: FilterOperator;
  label: string;
  symbol: string;
  needsValue: boolean;
  needsSecondValue?: boolean;
}

const TEXT_OPERATORS: OperatorOption[] = [
  { value: 'contains', label: 'contains', symbol: '~', needsValue: true },
  { value: 'equals', label: 'equals', symbol: '=', needsValue: true },
  { value: 'starts', label: 'starts with', symbol: '^', needsValue: true },
  { value: 'is_null', label: 'is null', symbol: '∅', needsValue: false },
  { value: 'not_null', label: 'not null', symbol: '∃', needsValue: false },
];

const NUMBER_OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'equals', symbol: '=', needsValue: true },
  { value: 'gt', label: 'greater than', symbol: '>', needsValue: true },
  { value: 'lt', label: 'less than', symbol: '<', needsValue: true },
  { value: 'range', label: 'between', symbol: '↔', needsValue: true, needsSecondValue: true },
  { value: 'is_null', label: 'is null', symbol: '∅', needsValue: false },
  { value: 'not_null', label: 'not null', symbol: '∃', needsValue: false },
];

export function ColumnFilterMenu({
  columnIndex,
  columnName,
  columnType,
  currentFilter,
  onApplyFilter,
  onClearFilter,
  onClose,
  anchorEl,
}: ColumnFilterMenuProps) {
  const [operator, setOperator] = useState<FilterOperator>(
    currentFilter?.operator || (columnType === 'number' ? 'equals' : 'contains')
  );
  const [value, setValue] = useState(currentFilter?.value?.toString() || '');
  const [value2, setValue2] = useState(currentFilter?.value2?.toString() || '');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const operators = columnType === 'number' ? NUMBER_OPERATORS : TEXT_OPERATORS;
  const currentOp = operators.find(op => op.value === operator) || operators[0];

  // Calculate position based on anchor element
  useEffect(() => {
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
      });
    }
  }, [anchorEl]);

  // Focus input on mount
  useEffect(() => {
    if (currentOp.needsValue) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [currentOp.needsValue]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleApply = useCallback(() => {
    if (currentOp.needsValue && !value.trim()) return;

    const filterValue = columnType === 'number' && value ? parseFloat(value) : value;
    const filterValue2 = columnType === 'number' && value2 ? parseFloat(value2) : undefined;

    onApplyFilter({
      columnIndex,
      columnName,
      type: columnType,
      operator,
      value: filterValue,
      value2: filterValue2,
    });
    onClose();
  }, [columnIndex, columnName, columnType, operator, value, value2, currentOp.needsValue, onApplyFilter, onClose]);

  const handleClear = useCallback(() => {
    onClearFilter();
    onClose();
  }, [onClearFilter, onClose]);

  // Keyboard handling
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleApply();
    }
  }, [onClose, handleApply]);

  const handleOperatorClick = (op: OperatorOption) => {
    setOperator(op.value);
    if (!op.needsValue) {
      // Auto-apply for null checks
      onApplyFilter({
        columnIndex,
        columnName,
        type: columnType,
        operator: op.value,
        value: '',
      });
      onClose();
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const menuContent = (
    <div
      className="column-filter-menu"
      ref={menuRef}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div className="filter-header">
        <span className="filter-column-name">{columnName}</span>
        {currentFilter && (
          <button
            className="filter-clear-btn"
            onClick={handleClear}
            title="Clear filter"
          >
            ×
          </button>
        )}
      </div>

      <div className="filter-operators">
        {operators.map((op) => (
          <button
            key={op.value}
            className={`filter-op-chip ${operator === op.value ? 'active' : ''}`}
            onClick={() => handleOperatorClick(op)}
            title={op.label}
          >
            <span className="op-symbol">{op.symbol}</span>
            <span className="op-label">{op.label}</span>
          </button>
        ))}
      </div>

      {currentOp.needsValue && (
        <div className="filter-inputs">
          <div className="filter-input-row">
            {currentOp.needsSecondValue && <span className="input-label">from</span>}
            <input
              ref={inputRef}
              type={columnType === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={columnType === 'number' ? '0' : 'Type to filter...'}
              className="filter-input"
            />
          </div>

          {currentOp.needsSecondValue && (
            <div className="filter-input-row">
              <span className="input-label">to</span>
              <input
                type="number"
                value={value2}
                onChange={(e) => setValue2(e.target.value)}
                placeholder="0"
                className="filter-input"
              />
            </div>
          )}
        </div>
      )}

      <div className="filter-actions">
        <span className="filter-hint">
          <kbd>↵</kbd> apply
          <kbd>esc</kbd> close
        </span>
        <button
          className="filter-apply-btn"
          onClick={handleApply}
          disabled={currentOp.needsValue && !value.trim()}
        >
          Apply
        </button>
      </div>
    </div>
  );

  // Render via portal to escape overflow:hidden
  return createPortal(menuContent, document.body);
}
