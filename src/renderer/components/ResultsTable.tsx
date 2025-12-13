// ABOUTME: Virtualized results table component for displaying large query results.
// ABOUTME: Uses @tanstack/react-virtual for performance with thousands of rows.

import { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { QueryResult } from '../../shared/types';
import './ResultsTable.css';

interface ResultsTableProps {
  results: QueryResult;
  onExportCSV?: () => void;
  onCopyToClipboard?: () => void;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  columnIndex: number | null;
  direction: SortDirection;
}

export function ResultsTable({ results, onExportCSV, onCopyToClipboard }: ResultsTableProps) {
  const [sortState, setSortState] = useState<SortState>({ columnIndex: null, direction: null });
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const parentRef = useRef<HTMLDivElement>(null);

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

  const totalRows = sortedRows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = currentPage * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  const rowVirtualizer = useVirtualizer({
    count: paginatedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

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
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;

    setResizingColumn(columnIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(th.offsetWidth);
  };

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

  return (
    <div className="results-table-container">
      <div ref={parentRef} className="results-scroll-container">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <table className="results-table-virtualized">
            <thead className="results-table-header">
              <tr>
                <th className="row-number-header">#</th>
                {results.columns.map((col, idx) => (
                  <th
                    key={idx}
                    onClick={() => handleSort(idx)}
                    className="sortable"
                    title="Click to sort"
                    style={columnWidths[idx] ? { width: `${columnWidths[idx]}px` } : undefined}
                  >
                    <span className="th-content">
                      {col}{getSortIndicator(idx)}
                    </span>
                    <span
                      className="resize-handle"
                      onMouseDown={(e) => handleResizeStart(e, idx)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = paginatedRows[virtualRow.index];
                const actualRowNumber = startIndex + virtualRow.index + 1;
                return (
                  <tr
                    key={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={virtualRow.index % 2 === 0 ? 'even' : 'odd'}
                  >
                    <td className="row-number-cell">{actualRowNumber}</td>
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        style={columnWidths[cellIdx] ? { width: `${columnWidths[cellIdx]}px` } : undefined}
                      >
                        {String(cell ?? '')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="results-footer">
        <div className="results-info">
          {totalRows.toLocaleString()} row{totalRows !== 1 ? 's' : ''} × {results.columns.length} column{results.columns.length !== 1 ? 's' : ''}
          {totalPages > 1 && (
            <span className="page-info">
              {' '}· Page {currentPage + 1} of {totalPages} (showing {startIndex + 1}-{endIndex})
            </span>
          )}
        </div>

        <div className="results-controls">
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
              <option value={totalRows}>All</option>
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
