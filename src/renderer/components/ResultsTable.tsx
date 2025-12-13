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

  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
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
      <div className="results-header">
        <div className="results-info">
          {results.rowCount.toLocaleString()} row{results.rowCount !== 1 ? 's' : ''} × {results.columns.length} column{results.columns.length !== 1 ? 's' : ''}
        </div>
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
                const row = sortedRows[virtualRow.index];
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
    </div>
  );
}
