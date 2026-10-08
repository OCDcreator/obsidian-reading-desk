# Reading Desk

A desktop Obsidian plugin for a shared library and excerpts anchored back to the source book.

## Language

**Book**:
A library entry identified by a stable book id. Its vault path can change; a missing file stays indexed so it can be relinked.
_Avoid_: File, document, pdf

**Excerpt**:
A persistable, bidirectionally navigable selection of source text. Its identity is the book, a text snapshot, and a format-specific anchor. It is not a copy of the passage.
_Avoid_: Highlight, clip, quote

**Anchor**:
The format-specific location that can reopen an Excerpt in the source. For PDF this is the 0-based physical page plus normalized rects. Another format carries its own anchor in the same excerpt, not a second store.
_Avoid_: Position, coordinates, CFI (as the general term)

**Reading context**:
The read-only facts Margin exposes about the current moment: the book id, the vault path, the text snapshot of the current selection or excerpt, its anchor, and its chapter path. It is not the book's excerpt list, not reading progress, not a chat transcript, and not a write permission.
_Avoid_: Prompt, context note, payload
