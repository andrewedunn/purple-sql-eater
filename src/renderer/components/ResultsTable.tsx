// ABOUTME: Virtualized results table component for displaying large query results.
// ABOUTME: Uses @tanstack/react-virtual for performance with thousands of rows.

import { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { QueryResult, ColumnFilter } from '../../shared/types';
import { ColumnFilterMenu } from './ColumnFilterMenu';
import './ResultsTable.css';

interface ResultsTableProps {
  results: QueryResult;
  filters: ColumnFilter[];
  onFiltersChange: (filters: ColumnFilter[]) => void;
  onExportCSV?: () => void;
  onCopyToClipboard?: () => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  columnIndex: number | null;
  direction: SortDirection;
}

interface SelectedCell {
  row: number;
  col: number;
}

// Determine if a value looks like a number
function isNumericColumn(rows: unknown[][], columnIndex: number): boolean {
  let numericCount = 0;
  let totalCount = 0;
  for (let i = 0; i < Math.min(rows.length, 100); i++) {
    const val = rows[i][columnIndex];
    if (val !== null && val !== undefined && val !== '') {
      totalCount++;
      if (typeof val === 'number' || !isNaN(Number(val))) {
        numericCount++;
      }
    }
  }
  return totalCount > 0 && numericCount / totalCount > 0.8;
}

// Apply a single filter to a value
function applyFilter(value: unknown, filter: ColumnFilter): boolean {
  if (filter.operator === 'is_null') {
    return value === null || value === undefined;
  }
  if (filter.operator === 'not_null') {
    return value !== null && value !== undefined;
  }

  if (value === null || value === undefined) {
    return false;
  }

  const stringValue = String(value).toLowerCase();
  const filterValue = String(filter.value).toLowerCase();

  switch (filter.operator) {
    case 'contains':
      return stringValue.includes(filterValue);
    case 'equals':
      if (filter.type === 'number') {
        return Number(value) === Number(filter.value);
      }
      return stringValue === filterValue;
    case 'starts':
      return stringValue.startsWith(filterValue);
    case 'gt':
      return Number(value) > Number(filter.value);
    case 'lt':
      return Number(value) < Number(filter.value);
    case 'range':
      const numVal = Number(value);
      return numVal >= Number(filter.value) && numVal <= Number(filter.value2);
    default:
      return true;
  }
}

// Apply all filters to rows
function applyFilters(rows: unknown[][], filters: ColumnFilter[]): unknown[][] {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((filter) => applyFilter(row[filter.columnIndex], filter))
  );
}

export function ResultsTable({ results, filters, onFiltersChange, onExportCSV, onCopyToClipboard }: ResultsTableProps) {
  const [sortState, setSortState] = useState<SortState>({ columnIndex: null, direction: null });
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [filterMenuColumn, setFilterMenuColumn] = useState<number | null>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [showNullHighlight, setShowNullHighlight] = useState(false);

  // Use filters from props
  const columnFilters = filters;
  const dataScrollRef = useRef<HTMLDivElement>(null);
  const headersScrollRef = useRef<HTMLDivElement>(null);
  const rowNumbersScrollRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sort rows
  const sortedRows = [...results.rows];
  if (sortState.columnIndex !== null && sortState.direction) {
    sortedRows.sort((a, b) => {
      const aVal = a[sortState.columnIndex!];
      const bVal = b[sortState.columnIndex!];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortState.direction === 'asc' ? comparison : -comparison;
    });
  }

  // Apply filters
  const filteredRows = applyFilters(sortedRows, columnFilters);

  const totalRows = filteredRows.length;
  const unfilteredCount = results.rows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const paginatedRows = filteredRows.slice(startIndex, endIndex);

  const rowVirtualizer = useVirtualizer({
    count: paginatedRows.length,
    getScrollElement: () => dataScrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  const totalTableWidth = results.columns.reduce((sum, _, idx) => {
    return sum + (columnWidths[idx] || 200);
  }, 0);

  const handleSort = (columnIndex: number) => {
    setSortState((prev) => {
      if (prev.columnIndex === columnIndex) {
        const newDirection = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
        return { columnIndex: newDirection ? columnIndex : null, direction: newDirection };
      }
      return { columnIndex, direction: 'asc' };
    });
  };

  const getSortIndicator = (columnIndex: number) => {
    if (sortState.columnIndex !== columnIndex) return '';
    return sortState.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const handleResizeStart = (e: React.MouseEvent, columnIndex: number) => {
    e.stopPropagation();
    const headerCell = (e.target as HTMLElement).closest('.header-cell');
    if (!headerCell) return;

    setResizingColumn(columnIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(headerCell.getBoundingClientRect().width);
  };

  const handleFilterClick = (e: React.MouseEvent, columnIndex: number) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    if (filterMenuColumn === columnIndex) {
      setFilterMenuColumn(null);
      setFilterMenuAnchor(null);
    } else {
      setFilterMenuColumn(columnIndex);
      setFilterMenuAnchor(target);
    }
  };

  const handleApplyFilter = (filter: ColumnFilter) => {
    const existing = columnFilters.findIndex((f) => f.columnIndex === filter.columnIndex);
    if (existing >= 0) {
      const updated = [...columnFilters];
      updated[existing] = filter;
      onFiltersChange(updated);
    } else {
      onFiltersChange([...columnFilters, filter]);
    }
    setCurrentPage(0); // Reset to first page when filtering
  };

  const handleClearFilter = (columnIndex: number) => {
    onFiltersChange(columnFilters.filter((f) => f.columnIndex !== columnIndex));
    setCurrentPage(0);
  };

  const getFilterForColumn = (columnIndex: number): ColumnFilter | undefined => {
    return columnFilters.find((f) => f.columnIndex === columnIndex);
  };

  // Format a value for clipboard/display as a string
  const formatValueForCopy = useCallback((value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      if ('value' in value && typeof (value as any).value !== 'undefined') {
        return formatValueForCopy((value as any).value);
      }
      return JSON.stringify(value);
    }
    return String(value);
  }, []);

  // Copy cell value to clipboard
  const copyCellValue = useCallback((row: number, col: number) => {
    const value = paginatedRows[row]?.[col];
    navigator.clipboard.writeText(formatValueForCopy(value));
  }, [paginatedRows, formatValueForCopy]);

  // Copy entire row to clipboard
  const copyRowValue = useCallback((row: number) => {
    const rowData = paginatedRows[row];
    if (!rowData) return;
    const text = rowData.map((cell) => formatValueForCopy(cell)).join('\t');
    navigator.clipboard.writeText(text);
  }, [paginatedRows, formatValueForCopy]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell) return;

    const { row, col } = selectedCell;
    const maxRow = paginatedRows.length - 1;
    const maxCol = results.columns.length - 1;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) setSelectedCell({ row: row - 1, col });
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (row < maxRow) setSelectedCell({ row: row + 1, col });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) setSelectedCell({ row, col: col - 1 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (col < maxCol) setSelectedCell({ row, col: col + 1 });
        break;
      case 'Enter':
        e.preventDefault();
        copyCellValue(row, col);
        break;
      case 'c':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          copyRowValue(row);
        }
        break;
      case 'Escape':
        setSelectedCell(null);
        break;
    }
  }, [selectedCell, paginatedRows.length, results.columns.length, copyCellValue, copyRowValue]);

  // Column resize effect
  useEffect(() => {
    if (resizingColumn === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX;
      const newWidth = Math.max(50, resizeStartWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  // Scroll synchronization effect
  useEffect(() => {
    const dataScroll = dataScrollRef.current;
    const headersScroll = headersScrollRef.current;
    const rowNumbersScroll = rowNumbersScrollRef.current;

    if (!dataScroll || !headersScroll || !rowNumbersScroll) return;

    const handleDataScroll = () => {
      headersScroll.scrollLeft = dataScroll.scrollLeft;
      rowNumbersScroll.scrollTop = dataScroll.scrollTop;
    };

    const forwardWheelToData = (e: WheelEvent) => {
      e.preventDefault();
      dataScroll.scrollBy({
        left: e.deltaX,
        top: e.deltaY,
        behavior: 'auto'
      });
    };

    dataScroll.addEventListener('scroll', handleDataScroll);
    headersScroll.addEventListener('wheel', forwardWheelToData, { passive: false });
    rowNumbersScroll.addEventListener('wheel', forwardWheelToData, { passive: false });

    return () => {
      dataScroll.removeEventListener('scroll', handleDataScroll);
      headersScroll.removeEventListener('wheel', forwardWheelToData);
      rowNumbersScroll.removeEventListener('wheel', forwardWheelToData);
    };
  }, []);

  // Format a value for display as a string
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'object') {
      // Handle BigQuery date wrapper objects and other objects
      if ('value' in value && typeof (value as any).value !== 'undefined') {
        return formatValue((value as any).value);
      }
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Format cell display
  const formatCell = (cell: unknown, isNull: boolean) => {
    if (isNull) {
      return showNullHighlight ? <span className="null-value">NULL</span> : '';
    }
    return formatValue(cell);
  };

  return (
    <div
      className="results-table-container"
      ref={tableContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Filter pills */}
      {columnFilters.length > 0 && (
        <div className="filter-pills">
          {columnFilters.map((filter) => (
            <div
              key={filter.columnIndex}
              className="filter-pill"
              onClick={(e) => {
                setFilterMenuColumn(filter.columnIndex);
                setFilterMenuAnchor(e.currentTarget as HTMLElement);
              }}
              title="Click to edit filter"
            >
              <span className="filter-pill-label">{filter.columnName}</span>
              <span className="filter-pill-value">
                {filter.operator === 'is_null' ? 'is NULL' :
                 filter.operator === 'not_null' ? 'is not NULL' :
                 filter.operator === 'range' ? `${filter.value} - ${filter.value2}` :
                 `${filter.operator} ${filter.value}`}
              </span>
              <button
                className="filter-pill-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearFilter(filter.columnIndex);
                }}
                title="Remove filter"
              >
                ×
              </button>
              {filterMenuColumn === filter.columnIndex && (
                <ColumnFilterMenu
                  columnIndex={filter.columnIndex}
                  columnName={filter.columnName}
                  columnType={filter.type}
                  currentFilter={filter}
                  onApplyFilter={handleApplyFilter}
                  onClearFilter={() => handleClearFilter(filter.columnIndex)}
                  onClose={() => { setFilterMenuColumn(null); setFilterMenuAnchor(null); }}
                  anchorEl={filterMenuAnchor}
                />
              )}
            </div>
          ))}
          <button
            className="filter-clear-all"
            onClick={() => onFiltersChange([])}
          >
            Clear all
          </button>
        </div>
      )}

      <div className="table-grid">
        {/* Top-left corner */}
        <div className="header-corner">#</div>

        {/* Column headers */}
        <div className="headers-container">
          <div ref={headersScrollRef} className="headers-scroll">
            <div className="results-table-header-row" style={{ width: `${totalTableWidth}px` }}>
              {results.columns.map((col, idx) => {
                const width = columnWidths[idx] || 200;
                const hasFilter = getFilterForColumn(idx);
                return (
                  <div
                    key={idx}
                    onClick={() => handleSort(idx)}
                    className={`header-cell sortable ${hasFilter ? 'has-filter' : ''}`}
                    title="Click to sort"
                    style={{ width: `${width}px` }}
                  >
                    <span className="th-content">
                      {col}{getSortIndicator(idx)}
                    </span>
                    <button
                      className={`filter-button ${hasFilter ? 'active' : ''}`}
                      onClick={(e) => handleFilterClick(e, idx)}
                      title="Filter column"
                    >
                      ⫶
                    </button>
                    <span
                      className="resize-handle"
                      onMouseDown={(e) => handleResizeStart(e, idx)}
                    />
                    {filterMenuColumn === idx && (
                      <ColumnFilterMenu
                        columnIndex={idx}
                        columnName={col}
                        columnType={isNumericColumn(results.rows, idx) ? 'number' : 'text'}
                        currentFilter={hasFilter}
                        onApplyFilter={handleApplyFilter}
                        onClearFilter={() => handleClearFilter(idx)}
                        onClose={() => { setFilterMenuColumn(null); setFilterMenuAnchor(null); }}
                        anchorEl={filterMenuAnchor}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row numbers */}
        <div className="row-numbers-container">
          <div ref={rowNumbersScrollRef} className="row-numbers-scroll">
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const actualRowNumber = startIndex + virtualRow.index + 1;
                return (
                  <div
                    key={virtualRow.index}
                    className={`row-number-cell ${virtualRow.index % 2 === 0 ? 'even' : 'odd'}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {actualRowNumber}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Data cells */}
        <div ref={dataScrollRef} className="data-container">
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            <div className="results-table-body" style={{ width: `${totalTableWidth}px` }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = paginatedRows[virtualRow.index];
                return (
                  <div
                    key={virtualRow.index}
                    className={`table-row ${virtualRow.index % 2 === 0 ? 'even' : 'odd'}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${totalTableWidth}px`,
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.map((cell, cellIdx) => {
                      const width = columnWidths[cellIdx] || 200;
                      const isNull = cell === null || cell === undefined;
                      const isSelected = selectedCell?.row === virtualRow.index && selectedCell?.col === cellIdx;
                      return (
                        <div
                          key={cellIdx}
                          className={`table-cell ${isNull && showNullHighlight ? 'null-cell' : ''} ${isSelected ? 'selected' : ''}`}
                          style={{ width: `${width}px` }}
                          onClick={() => setSelectedCell({ row: virtualRow.index, col: cellIdx })}
                        >
                          {formatCell(cell, isNull)}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="results-footer">
        <div className="results-info">
          {columnFilters.length > 0 ? (
            <span>{totalRows.toLocaleString()} of {unfilteredCount.toLocaleString()} rows (filtered)</span>
          ) : (
            <span>{totalRows.toLocaleString()} row{totalRows !== 1 ? 's' : ''}</span>
          )}
          <span> × {results.columns.length} column{results.columns.length !== 1 ? 's' : ''}</span>
          {totalPages > 1 && (
            <span className="page-info">
              {' '}· Page {currentPage + 1} of {totalPages} (showing {startIndex + 1}-{endIndex})
            </span>
          )}
        </div>

        <div className="results-controls">
          <button
            className={`btn-null-toggle ${showNullHighlight ? 'active' : ''}`}
            onClick={() => setShowNullHighlight(!showNullHighlight)}
            title="Toggle NULL visibility"
          >
            NULL
          </button>

          <label className="rows-per-page-label">
            Rows per page:
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(0);
              }}
              className="rows-per-page-select"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={unfilteredCount}>All</option>
            </select>
          </label>

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                onClick={() => setCurrentPage(0)}
                disabled={currentPage === 0}
                className="btn-pagination"
                title="First page"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="btn-pagination"
                title="Previous page"
              >
                ‹
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="btn-pagination"
                title="Next page"
              >
                ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages - 1)}
                disabled={currentPage >= totalPages - 1}
                className="btn-pagination"
                title="Last page"
              >
                »
              </button>
            </div>
          )}

          <div className="results-actions">
            {onCopyToClipboard && (
              <button className="btn-action" onClick={onCopyToClipboard} title="Copy to clipboard">
                Copy
              </button>
            )}
            {onExportCSV && (
              <button className="btn-action" onClick={onExportCSV} title="Export as CSV">
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
