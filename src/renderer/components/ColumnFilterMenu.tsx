// ABOUTME: Dropdown menu for column filtering in the results table.
// ABOUTME: Supports text and number filters with various operators.

import { useState, useEffect, useRef } from 'react';
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
}

const TEXT_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: 'Equals' },
  { value: 'starts', label: 'Starts with' },
  { value: 'is_null', label: 'Is NULL' },
  { value: 'not_null', label: 'Is not NULL' },
];

const NUMBER_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'range', label: 'Between' },
  { value: 'is_null', label: 'Is NULL' },
  { value: 'not_null', label: 'Is not NULL' },
];

export function ColumnFilterMenu({
  columnIndex,
  columnName,
  columnType,
  currentFilter,
  onApplyFilter,
  onClearFilter,
  onClose,
}: ColumnFilterMenuProps) {
  const [operator, setOperator] = useState<FilterOperator>(
    currentFilter?.operator || (columnType === 'number' ? 'equals' : 'contains')
  );
  const [value, setValue] = useState(currentFilter?.value?.toString() || '');
  const [value2, setValue2] = useState(currentFilter?.value2?.toString() || '');
  const menuRef = useRef<HTMLDivElement>(null);

  const operators = columnType === 'number' ? NUMBER_OPERATORS : TEXT_OPERATORS;
  const showValueInput = !['is_null', 'not_null'].includes(operator);
  const showValue2Input = operator === 'range';

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

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleApply = () => {
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
  };

  const handleClear = () => {
    onClearFilter();
    onClose();
  };

  return (
    <div className="column-filter-menu" ref={menuRef}>
      <div className="filter-menu-header">
        Filter: {columnName}
      </div>

      <div className="filter-menu-body">
        <div className="filter-field">
          <label>Operator</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as FilterOperator)}
          >
            {operators.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {showValueInput && (
          <div className="filter-field">
            <label>{showValue2Input ? 'From' : 'Value'}</label>
            <input
              type={columnType === 'number' ? 'number' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={columnType === 'number' ? '0' : 'Enter value...'}
              autoFocus
            />
          </div>
        )}

        {showValue2Input && (
          <div className="filter-field">
            <label>To</label>
            <input
              type="number"
              value={value2}
              onChange={(e) => setValue2(e.target.value)}
              placeholder="0"
            />
          </div>
        )}
      </div>

      <div className="filter-menu-footer">
        {currentFilter && (
          <button className="btn-clear" onClick={handleClear}>
            Clear
          </button>
        )}
        <button className="btn-cancel" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-apply" onClick={handleApply}>
          Apply
        </button>
      </div>
    </div>
  );
}
