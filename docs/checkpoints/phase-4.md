# Phase 4 checkpoint — 2026-09-18

## Actual evidence

- Crop selection produces normalized coordinates; Reader renders the crop Blob and main owns local/remote persistence.
- OSS/COS signing and Markdown image upload have unit coverage. Remote crop deliberately avoids a vault PNG and writes an external-image Canvas text node.
- The Test Vault startup capture after deployment reported no Reading Desk errors in `.obsidian-debug/reading-desk-final-reader-smoke-errors.log`.

## External boundary

- No OSS/COS credentials were provided. A real authenticated upload/read is therefore not asserted; connection and upload error states remain runnable.

## Next command

```bash
obsidian vault=testvault command id=obsidian-reading-desk:open-reader-in-focus-layout
```
