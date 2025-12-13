# Purple SQL Eater

Purple SQL Eater is a fun to use, simple desktop SQL client built with Electron. The goal is speed and simplicity, but with AI features to help users build quickly. The target audience is business intelligence analysis and other business analysts who write SQL.

This will be an open-source project and we can use other open-source components where appropriate. All code will be published to GitHub. 

## Project Status

Early development. Architecture and technology choices are still being made.

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

## Features / Roadmap

### Core Functionality

- Connect to databases (BigQuery first, then MySQL, PostgreSQL, Redshift, and other in the future)
- Schema browser showing tables, columns, views
- Search-as-you-type to find fields in schema
- SQL file storage with folder organization and search
- Syntax highlighting
- Export results to CSV
- Copy results to clipboard

### AI Features

- Autocomplete as you type (context-aware, knows your schema)
- Auto-documentation (add comments when saving a file)
- Natural language to SQL (describe what you want, it writes the query using schema knowledge and patterns from your previous queries)

