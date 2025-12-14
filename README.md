# Purple SQL Eater

A fast, simple SQL client built with Electron for business intelligence analysts and data professionals.

## Current Status

**Early Development** - Core features working and tested with BigQuery.

**What's Working:**
- ✅ BigQuery connection with service account authentication
- ✅ Fast schema browser (~3-5s load, instant from cache)
  - Background column loading with progress indicator
  - Advanced search with filter/highlight modes
  - Recent tables tracking
  - Keyboard navigation and double-click to insert
- ✅ File management system
  - Workspace folder selection
  - Create/rename/delete files and folders
  - Content and filename search
  - Smart date sorting (created/modified)
  - File watching for external changes
- ✅ Flexible layout system
  - Position Schema and File browsers independently (left/right)
  - Stacked or horizontal modes
  - Resizable panels
- ✅ SQL editor with syntax highlighting (Monaco)
- ✅ Query execution with virtualized results table
  - Handles 100k+ rows smoothly
  - Column sorting and resizing
  - Pagination
- ✅ Multi-tab interface with save/load
  - Auto-track unsaved changes
  - Keyboard shortcuts (Cmd+Enter, Cmd+T, Cmd+S)
- ✅ Export to CSV / Copy to clipboard
- ✅ Light/dark theme toggle

**Documentation:**
- 📖 [User Guide](USER_GUIDE.md) - How to use Purple SQL Eater
- 🛠️ [Developer Setup](#development-setup) - Below

## Project Structure

```
src/
  main/          - Electron main process (Node.js)
    connectors/  - Database connector implementations
    main.ts      - Main process entry point
    preload.ts   - Preload script for IPC
  renderer/      - React UI (browser)
    App.tsx      - Main application component
    main.tsx     - React entry point
  shared/        - Shared types between main and renderer
    types.ts     - TypeScript interfaces
```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   npm run dev
   ```

   This starts both the Vite dev server (renderer) and Electron (main process).

## Build

Build for production:
```bash
npm run build
```

## Tech Stack

- **Electron** - Desktop application framework
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Monaco Editor** - Code editor (VS Code's editor)
- **BigQuery SDK** - Google Cloud BigQuery connector

## Architecture

### Database Connector Pattern

All database connectors implement the `DatabaseConnector` interface:

```typescript
interface DatabaseConnector {
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  query(sql: string): Promise<QueryResult>;
  getSchema(): Promise<Schema>;
  getTables(): Promise<Table[]>;
  getColumns(tableName: string): Promise<Column[]>;
}
```

This allows the app to support multiple databases without changing core logic.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for detailed feature planning.

**Next Priorities:**
- [ ] Context-aware autocomplete (schema-aware suggestions)
- [ ] Query history tracking
- [ ] Additional database connectors (PostgreSQL, MySQL, Redshift)
- [ ] AI features (natural language to SQL, auto-documentation)
