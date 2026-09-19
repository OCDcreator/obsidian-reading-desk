# Phase 2 checkpoint — 2026-09-18

## Actual evidence

- Reader owns a per-view PDF renderer and persistent annotations use zero-based pages plus normalized PDF-space rectangles.
- Test Vault deployment after the text-selection fix recorded matching four-artifact SHA-256 values in `.obsidian-debug/deploy-final-reader-smoke.sha256` and startup build `0.1.0+2026-09-18T15:00:08.855Z` in `.obsidian-debug/reading-desk-final-reader-smoke-proof.log`.

## Live Reader smoke after the deployment

- PDF canvas and text layer rendered with 96 text spans.
- A real selected PDF passage created a normalized moss highlight and Canvas excerpt through the palette path.
- The native context menu path created a real Markdown target; comment popover created a timestamped comment.
- A real pointer crop wrote a PNG and Canvas target.
- The physical drag gesture cannot be established by the available accessibility automation because it cannot hold a PDF text selection during the pointer sequence. The Reader's frozen drag payload was instead verified with a synthetic drag event, producing a Canvas target. This is bounded evidence, not a claim of physical drag acceptance.
- One console error belongs to an earlier synthetic `PointerEvent` without an active pointer; the actual pointer crop produced no error.

## Next command

```bash
obsidian vault=testvault dev:console limit=100
```
