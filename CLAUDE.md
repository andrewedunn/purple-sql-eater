# Purple SQL Eater

A fast, simple desktop SQL client built with Electron. Speed and simplicity first, with AI features planned to help users work faster. Target audience: business intelligence analysts and other business analysts who write SQL.

Open-source project. All code published to GitHub.

## Project Status

**Core functionality complete.** BigQuery connection, schema browser, file management, and multi-tab editor are working and production-ready. Security hardening (credential encryption, path traversal protection) is complete. Missing: automated tests.

See [ROADMAP.md](./ROADMAP.md) for completed features and what's next.

## Design Philosophy

Performance is non-negotiable. Never add visual flourishes that compromise speed. A SQL client that feels slow is a failed SQL client, no matter how pretty it looks. Use the frontend design skill when making design decisions.

**Fundamentals first, then gild one lily.** Get the basics right — layout, typography, contrast, keyboard navigation — before adding any decorative touches. When the foundation is solid, add one deliberate layer of polish that communicates care. Not more. Over-designed interfaces feel desperate for approval.

**Wink at the audience once.** It's fine to include a moment of delight — a subtle animation, a clever detail — but don't beg for applause. If users notice the design constantly, something is wrong. Great design disappears into the experience.

**Specific guidance:**

- Prefer off-white and off-black over pure `#FFFFFF` and `#000000`. The subtle difference implies intentionality.
- If using shadows, add a hint of color rather than pure gray.
- Find comfortable line height and letter spacing for code and UI text. Don't just accept defaults.
- A single accent color used sparingly beats a rainbow of highlights.
- Avoid "cheap gilding" — animations and effects that are now so common they feel like templates. Sliding/fading sections, parallax, excessive motion. These no longer signal craft.
- When in doubt, remove. Simplicity that works beats complexity that impresses.

**The feel test:** Users may not consciously notice thoughtful details, but they'll feel it. Cumulative polish builds trust. A well-crafted interface signals that the tool itself is reliable.

## Working Principles

- YAGNI. Build what's needed now, not what might be needed later.
- Simple over clever. Prefer readable, maintainable code over concise or "elegant" solutions.
- Small changes. Make the smallest reasonable change to achieve the goal.
- No rewrites without permission. Don't throw away working code to rewrite it "better."

## Technical Architecture

### Stack
- **Electron 28** - Desktop application framework
- **React 18** - UI framework
- **TypeScript 5.3** - Type safety throughout
- **Vite 5** - Build tool and dev server
- **Monaco Editor** - Code editor (same as VS Code)
- **@tanstack/react-virtual** - Virtualization for large result sets
- **Zod** - Runtime type validation

### Project Structure
```
src/
├── main/                    # Electron main process (Node.js)
│   ├── main.ts              # Entry point, window creation, IPC handlers
│   ├── preload.ts           # Security bridge exposing IPC to renderer
│   ├── connectors/          # Database connector implementations
│   │   └── bigquery.ts      # BigQuery connector
│   └── services/            # Backend services
│       ├── SecureConnectionStorage.ts  # Encrypted credential storage
│       ├── FileSystemService.ts        # File I/O with path validation
│       ├── WorkspaceService.ts         # Workspace management
│       └── FileWatcherService.ts       # External file change detection
├── renderer/                # React UI (browser process)
│   ├── main.tsx             # React entry point
│   ├── App-new.tsx          # Main application component
│   ├── design-system.css    # CSS variables and theming
│   └── components/          # UI components
│       ├── SchemaBrowser.tsx     # Database schema explorer
│       ├── FileBrowser.tsx       # Workspace file tree
│       ├── ResultsTable.tsx      # Virtualized query results
│       ├── TabBar.tsx            # Multi-tab interface
│       └── ConnectionPicker.tsx  # Saved connections
└── shared/
    └── types.ts             # Shared TypeScript interfaces
```

### IPC Pattern

All communication between renderer and main process goes through `window.electron.*` methods exposed by the preload script:

```typescript
// Query execution
window.electron.executeQuery(sql)
window.electron.connect(config)
window.electron.getSchema()
window.electron.getColumns(tableName)

// File operations
window.electron.fileRead/Write/Create/Delete/Rename
window.electron.folderCreate/Delete/Rename/List
window.electron.workspaceSelect/Get/GetTree

// Connections
window.electron.connectionsSave/Delete/Get/Connect
```

Events from main to renderer via `ipcRenderer.on`:
- `schema-progress` - Schema loading progress
- `file-changed` / `file-deleted` - External file modifications

### Database Connector Pattern

All connectors implement the `DatabaseConnector` interface:
```typescript
interface DatabaseConnector {
  connect(config): Promise<void>
  disconnect(): Promise<void>
  query(sql): Promise<QueryResult>
  getSchema(): Promise<Schema>
  getTables(): Promise<Table[]>
  getColumns(tableName): Promise<Column[]>
}
```

Currently implemented: **BigQueryConnector**. Pattern supports adding PostgreSQL, MySQL, etc.

### State Management

React hooks only—no external state library. App component manages tabs, connection, schema, layout, theme.

**localStorage keys:**
- `purple-sql-eater-theme` - Light/dark mode
- `purple-sql-eater-recent-tables` - Recently queried tables
- `purple-sql-eater-layout` - Browser positioning
- `schema-cache-{connectionId}` - Cached schema per connection

## Security Architecture

**Credential Encryption:** Uses Electron's `safeStorage` API. Credentials stored encrypted in `~/.config/purple-sql-eater/connections.json`.

**Path Traversal Protection:** All file paths validated against workspace root via `validatePath()`. Prevents escape attempts with null bytes, excessive lengths, etc.

**IPC Security:**
- Context isolation enabled
- Node integration disabled
- Preload script acts as security bridge
- Only whitelisted operations exposed
- Credentials redacted from logs

## Development

### Setup
```bash
npm install
npm run dev     # Starts Vite + Electron with hot reload
```

### Build
```bash
npm run build   # Production build to dist/
npm start       # Run production build
```

### Keyboard Shortcuts
- `Cmd/Ctrl+Enter` - Execute query
- `Cmd/Ctrl+T` - New tab
- `Cmd/Ctrl+S` - Save file
- `Cmd/Ctrl+W` - Close tab

## Known Gaps

**No automated tests.** This is the biggest gap for production readiness. Should add tests before new features.
