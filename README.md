# Reading Desk

Margin v0.1.0 is a desktop-only Obsidian plugin for a shared PDF/EPUB library, PDF reading, anchored excerpts, comments, targets, and optional object storage.

## Develop

```bash
npm install
npm run verify
```

`npm run verify` runs documentation and owner guards, version validation, lint, Vitest, TypeScript checking, and the production bundle.

## Install in a test vault

Build first, then copy these four root-level artifacts to the plugin directory; they are intentionally not under `dist/`:

```text
main.js
manifest.json
styles.css
pdf.worker.mjs
```

For this workspace the Test Vault plugin directory is `/Volumes/SDD2T/obsidian-vault-write/testvault/.obsidian/plugins/obsidian-reading-desk/`. Reload only after all four copies finish, then compare SHA-256 values and check the first `[Reading Desk] Margin v… build …` console line.

The Test Vault keeps Obsidian’s core Canvas enabled because Canvas is a required Reading Desk target. For native Excalidraw-target acceptance it also has the official community plugin `obsidian-excalidraw-plugin` v2.27.3 enabled; this is test-vault-only setup, not a Reading Desk bundled dependency.

## Use

1. Set one or more library folders in **Reading Desk 设置**, then run **扫描 Reading Desk 书库**.
2. Open a PDF from the shelf. Reader layouts persist as focus or split.
3. Select PDF text and use the color button, the selection context menu, or drag to a target. Generated Canvas, Excalidraw, and Markdown cards retain an exact Reading Desk source link.
4. Configure OSS or COS only when you have credentials. Connection testing is read-only; Markdown image paste and remote crop upload stay disabled until object storage is enabled.
5. Use the settings import/export panel or command palette to non-destructively import legacy Bookshelf metadata and to export Markdown/JSON.

OpenCodian integration is optional. It is available only when its plugin and the two public commands needed to add the generated context note and open its view are present; no third-party private API is guessed.
