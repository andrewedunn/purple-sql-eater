# Purple SQL Eater

A fast, simple desktop SQL client built with Electron. Speed and simplicity first, with AI features planned to help users work faster. Target audience: business intelligence analysts and other business analysts who write SQL.

Open-source project. All code published to GitHub.

## Project Status

**Core functionality complete.** BigQuery connection, schema browser, file management, and multi-tab editor are working and production-ready. Security hardening (credential encryption, path traversal protection) is complete. Automated testing infrastructure is in place with CI.

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
│   ├── services/            # Backend services
│   │   ├── SecureConnectionStorage.ts  # Encrypted credential storage
│   │   ├── FileSystemService.ts        # File I/O with path validation
│   │   ├── FileSystemService.test.ts   # Tests for file operations
│   │   ├── WorkspaceService.ts         # Workspace management
│   │   └── FileWatcherService.ts       # External file change detection
│   └── utils/               # Utility functions
│       ├── pathValidation.ts           # IPC path validation
│       └── pathValidation.test.ts      # Tests for path validation
├── renderer/                # React UI (browser process)
│   ├── main.tsx             # React entry point
│   ├── App-new.tsx          # Main application component
│   ├── design-system.css    # CSS variables and theming
│   ├── test-setup.ts        # Test mocks for window.electron, localStorage
│   ├── components/          # UI components
│   │   ├── SchemaBrowser.tsx     # Database schema explorer
│   │   ├── FileBrowser.tsx       # Workspace file tree
│   │   ├── ResultsTable.tsx      # Virtualized query results
│   │   ├── TabBar.tsx            # Multi-tab interface
│   │   └── ConnectionPicker.tsx  # Saved connections
│   └── utils/               # Renderer utilities
│       ├── sqlSplitter.ts        # Split SQL into queries
│       ├── sqlSplitter.test.ts   # Tests for SQL splitting
│       ├── sqlParser.ts          # Extract table names from SQL
│       └── sqlParser.test.ts     # Tests for SQL parsing
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
- `file-changed` / `file-deleted` / `file-renamed` - External file modifications
- `folder-changed` - Workspace folder contents changed

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
- `purple-sql-eater-execution-mode` - Execute current vs all queries
- `purple-sql-eater-export-format` - CSV vs Excel export preference
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
- `Cmd/Ctrl+Enter` - Execute current query
- `Cmd/Ctrl+Shift+Enter` - Execute all queries
- `Cmd/Ctrl+Shift+F` - Format SQL
- `Cmd/Ctrl+T` - New tab
- `Cmd/Ctrl+S` - Save file
- `Cmd/Ctrl+W` - Close tab
- `Cmd/Ctrl+C` (in results) - Copy selected cell
- Arrow keys (in results) - Navigate cells

## Releasing

Releases are automated via GitHub Actions. When you push a version tag, builds are created for macOS, Windows, and Linux automatically.

### Release Process

1. **Bump version in package.json:**
   ```bash
   # Edit "version": "0.1.0" → "0.2.0"
   ```

2. **Commit and tag:**
   ```bash
   git add package.json
   git commit -m "Bump version to 0.2.0"
   git tag v0.2.0
   git push origin main --tags
   ```

3. **Monitor the build:**
   - Go to https://github.com/andrewedunn/purple-sql-eater/actions
   - The workflow builds on all three platforms (~5-10 minutes)
   - Creates a GitHub Release with all binaries attached

### Build Outputs
- **macOS:** `.dmg` (universal) + `.zip`
- **Windows:** `.exe` (NSIS installer)
- **Linux:** `.AppImage`

### Local Builds
```bash
npm run dist:mac    # Build for macOS only
npm run dist:win    # Build for Windows only (requires Windows)
npm run dist:linux  # Build for Linux only (requires Linux)
```

## Known Patterns

### Monaco Editor Stale Closures

Monaco's `addAction` captures the callback closure at registration time. If your action needs current React state, use refs:

```typescript
const executeRef = useRef<() => void>(() => {});

// Keep ref updated
useEffect(() => {
  executeRef.current = () => handleExecute();
});

// Register action once, ref always has current function
editor.addAction({
  id: 'execute',
  keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
  run: () => executeRef.current()
});
```

### File Watcher Suppression

When the app writes a file, suppress the file watcher to prevent "changed externally" notifications:

```typescript
fileWatcherService.suppressPath(filePath);
try {
  await writeFile(filePath, content);
} finally {
  setTimeout(() => fileWatcherService.unsuppressPath(filePath), 1500);
}
```

The 1500ms delay accounts for chokidar's stabilityThreshold (300ms) plus write time.

## Testing

### Running Tests

```bash
npm test              # Run main process tests (Node.js)
npm run test:renderer # Run renderer tests (React/browser)
npm run test:all      # Run both
npm run test:watch    # Watch mode for development
npm run test:coverage # Generate coverage reports
```

### Test Organization

Tests live alongside the code they test with `.test.ts` suffix:
- `src/main/**/*.test.ts` - Main process tests (run with Node environment)
- `src/renderer/**/*.test.ts` - Renderer tests (run with jsdom environment)

### Test Configuration

- `vitest.config.ts` - Main process test config (Node environment)
- `vitest.config.renderer.ts` - Renderer test config (jsdom + React Testing Library)
- `src/renderer/test-setup.ts` - Mocks for `window.electron` and `localStorage`

### Writing New Tests

**For main process code (services, utils):**
```typescript
// src/main/services/MyService.test.ts
import { describe, it, expect } from 'vitest';
import { MyService } from './MyService';

describe('MyService', () => {
  it('should do something', () => {
    const service = new MyService();
    expect(service.doThing()).toBe('expected');
  });
});
```

**For renderer code (components, utilities):**
```typescript
// src/renderer/utils/myUtil.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from './myUtil';

describe('myFunction', () => {
  it('should handle input', () => {
    expect(myFunction('input')).toBe('output');
  });
});
```

**For React components:**
```typescript
// src/renderer/components/MyComponent.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### CI/CD

Tests run automatically on every push and PR via GitHub Actions (`.github/workflows/test.yml`). Tests run on macOS, Windows, and Linux.

### Current Test Coverage

| Area | Coverage |
|------|----------|
| Path traversal security | ✅ FileSystemService.test.ts |
| IPC input validation | ✅ pathValidation.test.ts |
| SQL query splitting | ✅ sqlSplitter.test.ts |
| SQL table extraction | ✅ sqlParser.test.ts |
| React components | ⏳ Not yet covered |
| SecureConnectionStorage | ⏳ Not yet covered |

### Test Philosophy

- **Security first**: Path validation and traversal protection must have comprehensive tests
- **Pure functions are easy**: Utility functions like SQL parsing are ideal test candidates
- **Follow TDD for new features**: Write failing test, implement, verify
- **Don't test mocks**: Tests should verify real behavior, not mocked implementations
