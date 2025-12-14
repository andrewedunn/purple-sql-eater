# Purple SQL Eater - Development Roadmap

## Recently Completed ✅

### Performance & UX (December 2024)
- **Results Table Virtualization**: Handles 100k+ rows smoothly with @tanstack/react-virtual
- **Sticky Table Headers**: Column headers stay visible when scrolling
- **Schema Loading Optimizations**:
  - Parallel BigQuery dataset fetching (~30x faster: 120s → 3-5s)
  - localStorage caching (instant subsequent loads)
  - Background refresh strategy
  - Progress indicators for schema and column loading
- **Advanced Schema Browser**:
  - Search tables, columns, schemas with filter/highlight modes
  - Background column loading (batched for performance)
  - View/table/materialized view icons (T/V/M/E)
  - Recent tables section with jump-to functionality
  - Alphabetical sorting
- **Results Export**:
  - CSV export with proper escaping
  - Copy to clipboard (TSV format)
- **Polish**:
  - Reduced table padding
  - Better visual design with design system
  - Light/dark theme toggle
- **Layout System**:
  - Flexible browser positioning (Schema and File browsers)
  - Independent placement (left, right, hidden)
  - Stacked or horizontal modes when both on same side
  - Resizable browsers with direction-aware handles

## Up Next (High Priority)

### SQL File Storage
**Why**: Critical workflow need for saving and organizing queries
**Status**: Partially implemented - file browsing complete, file operations in progress
**Features**:
- [ ] Save query tabs to .sql files
- [x] File tree sidebar with workspace selection
- [x] Folder navigation and browsing
- [x] Smart date sorting (created/modified with cycling)
- [ ] File content search (currently filters by filename only)
- [ ] Auto-save drafts
- [ ] Create/rename/delete operations

### Context-Aware Autocomplete
**Why**: Major productivity boost for daily use
**Features**:
- [ ] Schema-aware completions (tables, columns)
- [ ] SQL keyword suggestions
- [ ] Function signatures
- [ ] Recently used tables/columns prioritized
- [ ] Works with Monaco editor's IntelliSense

### Query History
**Why**: Common use case - re-running recent queries
**Features**:
- [ ] Track all executed queries
- [ ] Timestamp + connection info
- [ ] Search history
- [ ] Re-run from history
- [ ] Star favorites

## Future Features

### Additional Database Connectors
**Status**: Planned
- [ ] PostgreSQL
- [ ] MySQL
- [ ] Amazon Redshift
- [ ] Snowflake

### Advanced AI Features
**Status**: Experimental
- [ ] Auto-documentation (comment generation on save)
- [ ] Natural language to SQL
- [ ] Query optimization suggestions
- [ ] Schema change detection

### Results Table Enhancements
**Status**: Nice-to-have
- [ ] Column resizing (drag to resize)
- [ ] Column sorting (click header to sort)
- [ ] Cell formatting (numbers, dates)
- [ ] Column hiding/reordering

## Completed Foundation ✅

**Core Infrastructure:**
- [x] Electron + React + TypeScript setup
- [x] Monaco Editor integration
- [x] Database connector abstraction pattern
- [x] IPC architecture (main ↔ renderer)
- [x] Design system with CSS variables
- [x] Light/dark theme support

**BigQuery Support:**
- [x] Service account authentication
- [x] Query execution
- [x] Schema browsing (parallel fetch)
- [x] Column metadata loading
- [x] View/table type detection

**UI Components:**
- [x] Connection management dialog
- [x] Tabbed query interface
- [x] Schema browser with tree view
- [x] Results table with virtualization
- [x] Theme toggle
- [x] Keyboard shortcuts

**Performance:**
- [x] Results virtualization (100k+ rows)
- [x] Schema caching (localStorage)
- [x] Parallel API requests
- [x] Background column loading
- [x] Progress indicators

## Implementation Philosophy

1. **Performance First**: Never compromise on speed
2. **Simple Over Clever**: Readable, maintainable code
3. **Progressive Enhancement**: Core features work, then add polish
4. **User Feedback**: Loading states, progress, errors
5. **Keyboard-Friendly**: Power users love shortcuts
