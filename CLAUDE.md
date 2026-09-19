# Reading Desk Development Rules

Use `npm run verify` before calling a stage complete. It includes `npm run check:project-docs`, `npm run check:owner-guard`, version validation, lint, test, and build.

## Single-Responsibility Rule

No source file exceeds 650 lines and no function exceeds 220 lines. Keep shelf metadata in `LibraryIndex`, annotations in `AnnotationStore`, and target-file writes in `TargetService`.

## Documentation Gate

`npm run check:project-docs` verifies this file, `AGENTS.md`, and required scripts. Maintain ADRs for architecture changes. Do not modify `../obsidian-bookshelf`.
