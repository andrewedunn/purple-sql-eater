# Purple SQL Eater - User Guide

A fast, simple SQL client designed for business intelligence analysts and data professionals.

## Table of Contents

- [Getting Started](#getting-started)
- [Connecting to Databases](#connecting-to-databases)
- [Schema Browser](#schema-browser)
- [File Browser](#file-browser)
- [Layout Configuration](#layout-configuration)
- [Writing Queries](#writing-queries)
- [Working with Results](#working-with-results)
- [Tabs and Navigation](#tabs-and-navigation)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tips and Tricks](#tips-and-tricks)

---

## Getting Started

### First Launch

1. Launch Purple SQL Eater
2. You'll see an empty query editor with "Query 1" tab
3. Click the connection dropdown to configure your database connection

### Theme

Toggle between light and dark mode using the theme button in the top-right toolbar.

---

## Connecting to Databases

### BigQuery

**Initial Setup:**
1. Click the connection dropdown in the toolbar
2. Select "New Connection"
3. Choose "BigQuery" as the database type
4. Configure your connection:
   - **Connection Name**: A friendly name (e.g., "Production", "Analytics")
   - **Project ID**: Your Google Cloud project ID
   - **Authentication**:
     - **Service Account Key File**: Path to your JSON key file
     - **OR Credentials**: Paste JSON credentials directly
5. Optionally check "Save connection" to reuse this configuration
6. Click "Connect"

**Reconnecting:**
- Saved connections appear in the connection dropdown
- Click any saved connection to reconnect instantly
- Your connection credentials are stored locally

**Disconnecting:**
- Click the connection dropdown and select "Disconnect"
- This clears your active connection but preserves saved connections

---

## Schema Browser

The schema browser shows your database structure on the left side of the screen.

### Loading Your Schema

**First Load:**
- When you connect, the schema loads automatically
- BigQuery: ~3-5 seconds for the initial load (parallelized dataset fetching)
- Tables appear first with "..." for column counts

**Subsequent Loads:**
- Instant! Schema is cached locally per connection
- Background refresh keeps cache up-to-date

**Background Column Loading:**
- After schema loads, columns load automatically in the background
- Progress indicator shows: "Loading columns: 52 / 625"
- Column counts update from "..." to actual numbers as they load
- Search works fully once all columns are loaded

**Manual Refresh:**
- Click the ↻ button to refresh
- **Shift + Click** the ↻ button to bypass cache (hard refresh)

### Understanding the Schema Tree

**Structure:**
```
Schema (dataset)
  ├─ Table (T icon)
  ├─ View (V icon)
  ├─ Materialized View (M icon)
  └─ External Table (E icon)
```

**Icons:**
- **T** = Regular table
- **V** = View
- **M** = Materialized view
- **E** = External table

**Expanding/Collapsing:**
- Click any schema or table to expand/collapse
- ◧ button: Collapse all
- ◨ button: Expand all schemas
- ▶/▼ icons indicate collapsed/expanded state

### Recent Tables

A "Recent" section appears at the top showing your 10 most recently queried tables.

**Using Recent:**
- **Single-click**: Jumps to that table in the schema browser (expands and scrolls)
- **Double-click**: Inserts the table name into your query
- Click the ▼ icon to collapse the Recent section

### Search

**Basic Search:**
1. Type in the search box at the top of the schema browser
2. Results appear instantly
3. Click ✕ to clear search

**Search Modes:**

**Scope Toggle (◎/○):**
- **◎ (filled)**: Search all - tables, schemas, AND columns
- **○ (empty)**: Search tables and schemas only

**Display Mode (⊙/⊕):**
- **⊙ (filter)**: Hide non-matches, auto-expand matches
- **⊕ (highlight)**: Show all, highlight matches in yellow

**Search Behavior:**
- Filter mode auto-expands matching schemas and tables
- Highlights matches in table/column names
- Search is case-insensitive
- Clearing search restores your previous expand/collapse state

**Column Search Notes:**
- Column search only works for tables with loaded columns
- If columns haven't loaded yet, they won't appear in search
- Wait for "Loading columns" indicator to complete for full search

### Inserting Names into Queries

**Double-click** any item to insert into your query:
- Schema: `dataset_name`
- Table: `dataset_name.table_name`
- Column: `dataset_name.table_name.column_name`

### Resizing

Drag the right edge of the schema browser to resize (min 200px, max 600px).

### Hiding/Showing

- Click ◀ to hide the schema browser
- Click ▶ (on left edge) to show it again

---

## File Browser

The file browser lets you browse and manage SQL files in your workspace folder.

### Setting Up a Workspace

**Select Folder:**
1. Click the folder icon (📁) in the file browser header
2. Choose a folder containing your SQL files
3. The file browser shows all .sql files in that folder and subfolders

**Workspace Info:**
- Current workspace path shown at bottom of file browser
- File count displayed

### Browsing Files

**File Tree:**
- Folders show item count in parentheses
- Click folders to expand/collapse
- SQL files show with smart date formatting

**Date Display:**
- Click the date column header to cycle through sorting modes:
  - Modified ↓ (newest first)
  - Modified ↑ (oldest first)
  - Created ↓ (newest first)
  - Created ↑ (oldest first)
- Date format adjusts automatically:
  - Recent: "2h ago", "Yesterday"
  - This week: "3d ago"
  - This year: "Dec 13"
  - Previous years: "Mar 27, 2024"

**Name Sorting:**
- Click the "Name" column header to sort alphabetically
- Toggle between ascending (↑) and descending (↓)

### File Search

Type in the search box to filter files by name (SQL files only).

### Resizing and Hiding

- Drag the edge of the file browser to resize
- Click the collapse button to hide/show

---

## Layout Configuration

Configure where the Schema and File browsers appear using the layout menu (grid icon) in the toolbar.

**Browser Positioning:**
- **Schema Browser**: Left, Right, or Hidden
- **File Browser**: Left, Right, or Hidden

**Layout Modes** (when both browsers on same side):
- **Stacked**: Browsers stack vertically with resizable divider
- **Horizontal**: Browsers side-by-side with independent widths

**Resizing:**
- Drag browser edges to resize
- Drag divider between stacked browsers to adjust split
- Each browser remembers its width independently

---

## Writing Queries

### SQL Editor

**Features:**
- Full SQL syntax highlighting
- Monaco editor (same as VS Code)
- Auto-indentation
- Multi-cursor editing (Alt/Option + Click)
- Find/replace (Cmd/Ctrl + F)

**Editing:**
- Each tab has its own independent query
- Changes are held in memory (not auto-saved)
- Results are preserved per tab

### Executing Queries

**Run Query:**
- Click the "Execute" button in the toolbar
- **OR** press **Cmd+Enter** (Mac) / **Ctrl+Enter** (Windows/Linux)

**While Running:**
- Button shows "Executing..."
- You cannot run multiple queries simultaneously

**After Execution:**
- Results appear in the lower panel
- Row count flashes briefly in the toolbar
- Any errors appear in red in the results panel

---

## Working with Results

### Results Table

**Display:**
- Results appear below the query editor
- Virtualized for performance (handles large result sets smoothly)
- Column headers show column names
- NULL values appear as `NULL` in gray

**Navigation:**
- Scroll vertically and horizontally
- Column headers are sticky (stay visible when scrolling)

### Exporting Results

**Export to CSV:**
1. Click "Export CSV" button above results
2. File downloads automatically as `query-results-{timestamp}.csv`
3. Handles special characters, quotes, and newlines properly

**Copy to Clipboard:**
1. Click "Copy" button above results
2. Results copy as tab-separated values (TSV)
3. Paste into Excel, Google Sheets, or any spreadsheet app

**Format:**
- CSV: Comma-separated, properly quoted
- Clipboard: Tab-separated (universal spreadsheet format)

---

## Tabs and Navigation

### Managing Tabs

**Creating Tabs:**
- Click the **+** button next to tabs
- **OR** press **Cmd+T** (Mac) / **Ctrl+T** (Windows/Linux)
- New tabs start with `-- Write your SQL query here`

**Switching Tabs:**
- Click any tab to switch
- Each tab maintains its own:
  - SQL query
  - Results
  - Scroll position

**Renaming Tabs:**
1. Double-click the tab title
2. Type a new name
3. Press Enter

**Closing Tabs:**
- Click the ✕ on any tab
- Cannot close the last tab (minimum 1 tab required)
- Closing a tab discards its query and results

**Tab Behavior:**
- Active tab is highlighted
- Up to ~10 tabs visible before scrolling
- Tabs are ordered left-to-right

---

## Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Execute query | Cmd+Enter | Ctrl+Enter |
| New tab | Cmd+T | Ctrl+T |
| Find in editor | Cmd+F | Ctrl+F |
| Replace in editor | Cmd+H | Ctrl+H |

**Editor Shortcuts** (Monaco):
- Multi-cursor: Alt+Click
- Select all occurrences: Cmd/Ctrl+Shift+L
- Comment line: Cmd/Ctrl+/
- Indent: Tab
- Outdent: Shift+Tab

---

## Tips and Tricks

### Performance

**Schema Loading:**
- First connection: 3-5 seconds (BigQuery parallelized fetch)
- Subsequent loads: Instant (cached per connection)
- Hard refresh: Shift+Click the ↻ button

**Column Loading:**
- Happens in background after schema loads
- Batched in groups of 10 to avoid API throttling
- Progress shown: "Loading columns: X / Y"
- Search fully functional once complete

**Query Results:**
- Virtualized table handles 100,000+ rows smoothly
- Only visible rows are rendered (performance optimization)

### Schema Browser

**Quick Navigation:**
- Use Recent section for frequently queried tables
- Click (don't double-click) recent tables to jump to them
- Keyboard: Arrow keys to navigate tree (when focused)
- Enter key inserts selected item

**Search Strategy:**
- Start with table-only search (○) for faster results
- Switch to full search (◎) when you need column search
- Use filter mode (⊙) to auto-expand matches
- Use highlight mode (⊕) to see context

**Column Counts:**
- "..." means columns haven't loaded yet
- Number means columns are loaded
- Hover for tooltip showing load status

### Writing Queries

**Best Practices:**
- Use tabs to organize related queries
- Rename tabs to describe what they do
- Recent tables section tracks what you're working with
- Double-click schema items to insert exact names (avoid typos)

### Data Export

**Large Results:**
- CSV export handles any result size
- Clipboard best for < 10,000 rows
- TSV format (clipboard) preserves data types better than CSV

**Special Characters:**
- CSV export properly escapes quotes, commas, newlines
- Clipboard preserves tabs and newlines for spreadsheets

---

## Troubleshooting

### Schema Won't Load

1. Check your database connection
2. Try disconnecting and reconnecting
3. Hard refresh (Shift+Click ↻)
4. Check console for errors (View → Toggle Developer Tools)

### Columns Not Appearing in Search

- Wait for "Loading columns" indicator to finish
- Column loading happens in background (10 tables at a time)
- Some tables may fail to load columns (permissions, deleted tables)

### Query Execution Hangs

- Check for long-running query in BigQuery console
- Disconnect and reconnect to cancel
- Check query for expensive operations (cross joins, missing WHERE clauses)

### Performance Issues

- Clear cache (disconnect, hard refresh on reconnect)
- Close unused tabs
- For very large results (100k+ rows), consider LIMIT clauses

---

## Supported Databases

### Currently Supported

- **Google BigQuery**
  - Full schema browsing
  - Parallel dataset loading
  - Background column metadata fetch
  - View/table/materialized view detection

### Coming Soon

- PostgreSQL
- MySQL
- Amazon Redshift
- Snowflake

---

## Getting Help

- Report issues: [GitHub Issues](https://github.com/anthropics/purple-sql-eater/issues)
- Feature requests: [GitHub Discussions](https://github.com/anthropics/purple-sql-eater/discussions)
- Documentation: This guide + README.md

---

**Last Updated:** 2024-12-13
**Version:** 0.1.0 (Early Development)
