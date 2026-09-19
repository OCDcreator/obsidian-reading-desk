# Reading Desk Agent Guide

Codename: **Margin**. This is a desktop-only Obsidian plugin for a shared library and anchored PDF annotations.

## Commands

```bash
npm run check:project-docs
npm run check:owner-guard
npm run version:check
npm run lint
npm test
npm run build
npm run verify
```

## Single-Responsibility Rule

Keep source modules under 650 lines and functions under 220 lines. `LibraryIndex` is the only book metadata index; `AnnotationStore` is the only annotation source; `TargetService` owns native target file mutation. Preserve normalized PDF `rects[]`, not screen pixels.

`ReaderView` owns per-leaf PDF interaction and rasterization; `PdfRenderer` owns PDF.js lifecycle. `main.ts` is the application composition boundary: Vault events, protocol routing, commands, Obsidian resource URLs, deployment-facing host callbacks, optional AI bridge, and external persistence wiring belong there. Do not move Reader rendering, target serialization, or library persistence into `main.ts`.

`ReadingDeskSettingTab` owns settings controls and status presentation. `AiIntegrationService` only resolves explicitly supported, enabled public contracts; absent plugins stay disabled. `MarkdownImagePasteService` and `ObjectStorageService` own payload/upload protocol behavior, while `main.ts` owns the Markdown editor event and insertion.

## Documentation Gate

`npm run check:project-docs` and `npm run check:owner-guard` are mandatory parts of `npm run verify`. Update ADRs and module documentation when ownership or persistence changes.

## Deployment

After build, copy root-level `main.js`, `manifest.json`, `styles.css`, and `pdf.worker.mjs` sequentially to `/Volumes/SDD2T/obsidian-vault-write/testvault/.obsidian/plugins/obsidian-reading-desk/`, then verify SHA-256 and a fresh, Reading Desk-scoped console startup identifier. Do not treat unrelated plugin errors as Reading Desk failures and do not touch other plugins.
