# Purple SQL Eater - Development Roadmap

## Critical Issues (Performance & UX Blockers)

### 1. Results Table Virtualization
**Problem**: 6K+ rows freeze the UI
**Solution**: Implement virtual scrolling (render only visible rows)
**Priority**: CRITICAL
**Status**: Not started

### 2. Sticky Table Headers
**Problem**: Can't see column names when scrolling results
**Solution**: CSS sticky positioning for thead
**Priority**: CRITICAL
**Status**: Not started

### 3. Schema Loading Indicator
**Problem**: Long schema load with no feedback
**Solution**: Show loading state in sidebar
**Priority**: HIGH
**Status**: Not started

### 4. Schema Caching Strategy
**Problem**: Schema loads from scratch every time
**Solution**: Cache in localStorage with TTL, refresh in background
**Priority**: HIGH
**Status**: Not started

## High Priority Features

### 5. Results Table Improvements
- [ ] Reduce padding (too much whitespace)
- [ ] Column resizing (drag to resize)
- [ ] Column sorting (click header to sort)
- [ ] Better visual design
- [ ] Alternating row colors for readability
**Priority**: HIGH
**Status**: Not started

### 6. CSV Export
**Problem**: Can't export results for sharing
**Solution**: Export button → download CSV file
**Priority**: HIGH
**Status**: Not started

### 7. Copy to Clipboard
**Problem**: Can't copy results to paste elsewhere
**Solution**: Copy button → clipboard with tab-delimited format
**Priority**: HIGH
**Status**: Not started

## Medium Priority Features

### 8. SQL File Management
- [ ] Save SQL to files
- [ ] Folder organization
- [ ] Search across saved queries
**Priority**: MEDIUM
**Status**: Not started

### 9. Query History
- [ ] Track executed queries
- [ ] Re-run from history
**Priority**: MEDIUM
**Status**: Not started

### 10. AI Features
- [ ] Autocomplete (context-aware, knows schema)
- [ ] Auto-documentation (add comments when saving)
- [ ] Natural language to SQL
**Priority**: MEDIUM
**Status**: Not started

## Completed ✓

- [x] Git repository initialization
- [x] Electron + React + TypeScript setup
- [x] Monaco Editor integration
- [x] BigQuery connector with abstraction pattern
- [x] Connection management (save/load connections)
- [x] Tabbed interface
- [x] Schema browser with search
- [x] Keyboard shortcuts (Cmd+Enter, Cmd+T)
- [x] Design system (light + dark themes)
- [x] Theme toggle with persistence

## Implementation Order Recommendation

**Phase 1: Fix Performance Issues (Session 1)**
1. Results table virtualization
2. Sticky headers
3. Schema loading indicator

**Phase 2: Results Table Polish (Session 2)**
4. Reduce padding, improve design
5. Column resizing
6. Column sorting

**Phase 3: Export Features (Session 3)**
7. CSV export
8. Clipboard support

**Phase 4: Schema Optimization (Session 4)**
9. Schema caching with TTL
10. Background refresh strategy

**Phase 5: Power User Features (Future)**
11. SQL file management
12. Query history
13. AI features

## Notes

- Performance issues block real usage - must fix first
- Results table is the primary UI - make it excellent
- Export features are table stakes for BI work
- AI features are differentiators but can wait
