# Query Editor & Results Window Roadmap
## Purple SQL Eater

*"Nail the fundamentals. Then, gild just one lily."*

---

## The Roadmap

### Phase 1: Smart Query Execution (High Impact, Medium Effort)

**The Problem:** Most SQL files have multiple queries. Users want to run just one, all of them, or a selection — and current tools make this confusing with separate buttons and shortcuts.

**The Solution: One Shortcut, Smart Behavior**

| State | Cmd+Enter Does |
|-------|----------------|
| Text selected | Run selection |
| Cursor in query | Run current query (auto-detect boundaries via `;`) |
| Multiple queries, none focused | Run all |

This matches SSMS behavior that users describe as "the way it should work everywhere." No extra buttons, no cognitive load. We need sensible, standard shortcuts for run current query / highlighted query and run all queries.

**Implementation:**
- Parse queries by `;` delimiter (handling strings/comments)
- Detect "current query" by cursor position
- Selection always takes priority

**The Gilt Lily:** When running a single query from a multi-query file, briefly highlight the query being executed with a subtle pulse (200ms fade) so users have visual confirmation of scope.

**UI Additions:**
- Toolbar dropdown: "Execute ▾" with options (Current Query, All Queries, Selection)
- Keyboard shortcuts shown inline in dropdown
- Status bar shows "Executed 1 of 3 queries" when relevant

---

### Phase 2: Results for Multiple Queries (High Impact, Medium Effort)

**The Problem:** Running multiple queries needs multiple result sets. How to display them?

**The Solution: Result Tabs (Not Nested)**

When multiple queries run:
- Results area gets horizontal tabs: `Results 1` | `Results 2` | `Results 3`
- Each tab shows its query snippet on hover
- Tab shows row count badge: `Results 1 (1,847)`
- Active result highlighted; others accessible via click or keyboard (Opt+1, Opt+2, etc.)

**Why not split view?** We tested this mentally — split views become confusing fast. Tabs are familiar, simple, scalable.

**The Gilt Lily:** Color-code result tabs based on query outcome:
- Success: subtle green left border
- Error: subtle red left border
- No results (0 rows): subtle amber

THESE COLORS ARE JUST EXAMPLES. Use whatever is complementary with the current color schema in light and dark modes.

Users won't consciously notice, but they'll *feel* confident about which queries succeeded.

---

### Phase 3: Context-Aware Autocomplete (High Impact, High Effort)

**The Problem:** Writing queries is tedious. Users want help with table names, column names, and SQL keywords — but hate intrusive popups.

**The Solution: Gentle Intelligence**

Monaco already supports IntelliSense. We integrate:

1. **Schema-aware completions:**
   - Tables from schema browser
   - Columns (after typing `tablename.` or in SELECT/WHERE context)
   - Recently used tables prioritized

2. **SQL keyword completion:**
   - Standard keywords
   - BigQuery-specific functions (later: PostgreSQL, etc.)

3. **Non-intrusive triggers:**
   - After `.` (columns)
   - After `FROM ` / `JOIN ` (tables)
   - Ctrl+Space for manual invoke
   - **Never** auto-popup while typing normally

---

### Phase 4: Results Window Power Features (Medium Impact, Low Effort)

**Current state:** You already have column sorting, resizing, pagination, and export. Nice!

**Additions:**

1. **Column Filtering:**
   - Click column header → dropdown with filter options
   - Text: contains, starts with, equals
   - Numbers: equals, greater than, less than, range
   - Applied filters show as pills above results

2. **Keyboard Navigation:**
   - Arrow keys navigate cells
   - Enter copies cell value to clipboard
   - Cmd+C copies selected row(s)

3. **Null Visibility Toggle:**
   - Button to highlight/hide NULL values
   - When highlighted: distinct background color

**The Gilt Lily:** When copying to clipboard, show a brief toast notification: "Copied 3 rows" that fades in 1.5 seconds. Confirms the action without interrupting flow.

---

## Delightful Touches Bank

Small ideas to sprinkle throughout. Pick one per release cycle.

### Micro-Animations
- **Row count pulse:** Already implemented ✓
- **Query execution glow:** Brief highlight on the "Run" button during execution
- **Success state:** Results table fades in rather than appearing instantly (150ms)
- **Execution progress:** For long queries, show a thin purple progress bar 
## The Feel Test

--

Before shipping each phase, ask:

1. **Does it feel fast?** If there's any perceptible lag, fix it first.
2. **Does it feel obvious?** A new user should discover the feature naturally.
3. **Does it feel finished?** No rough edges, missing states, or half-done UI.
4. **Does it spark joy?** Not every feature needs to, but one per release should.

---

## Closing Thought

Purple SQL Eater doesn't need to compete with DataGrip on features. It needs to compete on *feel*. The market is full of cluttered, slow, confusing SQL tools. There's a clear opening for something that's:

- **Fast** (you're already there with virtualization)
- **Simple** (fewer features, done better)
- **Delightful** (the unexpected small touches)

Gild one lily at a time. Users will notice — even if they can't articulate why Purple SQL Eater just feels better than the alternatives.
