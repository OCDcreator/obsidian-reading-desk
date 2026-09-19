# Reader runtime smoke — 2026-09-18

Build: `0.1.0+2026-09-18T15:00:08.855Z`.

Fixture: `Reading Desk Fixtures/reader-text-fixture.pdf` in Test Vault. Loaded proof: one PDF canvas, 96 text-layer spans, and no fresh errors after a cleared console/error buffer.

- Palette selection created a normalized moss highlight and real Canvas target.
- CUA activated the visible native `添加到Markdown` context-menu action, producing a real Markdown target.
- Comment popover saved `Reader smoke comment` with a timestamp.
- A real CUA pointer drag selected a crop, and `创建裁剪对象` produced a PNG plus Canvas target.
- The drag-excerpt path has a runtime synthetic DragEvent proof with frozen text/rects; physical CUA drag cannot be asserted because that automation surface cannot set a PDF text selection range.

This is functional smoke evidence, not visual approval. The `setPointerCapture` NotFoundError in the earlier console log came from a synthetic PointerEvent with no active operating-system pointer; it is not attributed to the later physical crop action.
