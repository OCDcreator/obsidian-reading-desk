# Phase 4 checkpoint — 2026-09-18

## Actual evidence

- Crop selection produces normalized coordinates; Reader renders the crop Blob and main owns local/remote persistence.
- OSS/COS signing and Markdown image upload have unit coverage. Remote crop deliberately avoids a vault PNG and writes an external-image Canvas text node.
- The Test Vault startup capture after deployment reported no Reading Desk errors in `.obsidian-debug/reading-desk-final-reader-smoke-errors.log`.

## External boundary

- No OSS/COS credentials were provided. A real authenticated upload/read is therefore not asserted; connection and upload error states remain runnable.

## Next command

```bash
`open-reader-in-focus-layout` 作为旧命令 id 保留兼容，只打开当前/首本 PDF，不再写入已废弃的 focus 布局偏好。
```
