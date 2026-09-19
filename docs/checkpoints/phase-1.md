# Phase 1 checkpoint — 2026-09-18

## Actual evidence

- `LibraryIndex` scans configured folders and preserves its unified book index; metadata extraction handles PDF/EPUB and cache paths.
- Data-focused final evidence before this checkpoint: `npm run verify` at 23:00 local time passed 14 Vitest files / 52 tests plus lint, docs/owner/version gates and build; log: `.obsidian-debug/full-verify-final-reader-text-layer.log`.
- Functional gate independently recorded legacy Bookshelf directory import and app-host wiring in `docs/self-check/functional-host-integration-first-result.json`.

## Still awaiting independent surface proof

- Shelf cover resource-URL display and all shelf interactions remain subject to the visual/functional review surfaces; this checkpoint does not claim their live acceptance.

## Next command

```bash
obsidian vault=testvault command id=obsidian-reading-desk:open-reading-desk
```
