# Purple SQL Eater

A simple, fast SQL client built with Electron for business intelligence analysts.

## Current Status

Early development - basic structure in place. BigQuery connector implemented but not yet tested with real credentials.

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

## Next Steps

- [ ] Test BigQuery connection with real credentials
- [ ] Add connection UI for BigQuery configuration
- [ ] Implement schema browser
- [ ] Add keyboard shortcuts for query execution
- [ ] Implement CSV export
- [ ] Add clipboard support
