# Reading Desk

Margin v0.5.0 is a desktop-only Obsidian plugin for a shared PDF/EPUB library, PDF reading, anchored excerpts, comments, targets, and optional object storage.

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
2. Filter and sort the shelf, create/rename/delete reading lists, or batch-edit tags, categories and reading status. View, filter and page preferences survive reopening; pending table drafts survive background saves. Open a PDF, or search excerpts and comments across the library.
3. Select PDF text and use the color button, the selection context menu, or drag to a target. Generated Canvas, Excalidraw, and Markdown cards retain an exact Reading Desk source link. Indexed PDFs restore their precise reading position and support named bookmarks. Printed page labels work in page navigation and copied citations; enter `#12` for physical page 12. Labels never change annotation page indices.
4. Configure OSS or COS only when you have credentials. Connection testing is read-only; Markdown image paste and remote crop upload stay disabled until object storage is enabled.
5. Use the settings data panel to import legacy Bookshelf metadata, CSL JSON, BibTeX or Zotero JSON. Select the entries to import and confirm local attachments individually or in a batch of unique matches; repeated imports use source identity and preserve manual metadata. Conflicts and unconfirmed paths are explicitly skipped.
6. Export and restore a versioned full plugin-data backup from the same panel. It contains annotation geometry, comments, cards, lists and settings; it does **not** contain PDF/EPUB files, covers or native target notes. Back those files up with the vault. Cloud credentials are excluded by default.
7. The data panel also exposes pending-save retry, protected reload, target-write recovery, recoverable annotations and safe fixed-placeholder excerpt templates. Inspect recovery snapshot space, preview retention by count or days, and explicitly confirm cleanup; protected and latest usable snapshots remain. Restore previews support object decisions, with each annotation and its comments/card/intent/deletion record selected together. Public backup import/export supports up to 64 MiB.
8. The annotation drawer flags changed or unknown source-file information and can search the original quote for manual anchor verification. File size/modification time are diagnostic hints, not content hashes; no annotation coordinates are moved automatically. Missing source files remain indexed and can be explicitly reconnected.

The repository checks external data before writes and preserves the prior value under the plugin directory's `recovery/` folder. This detects stale snapshots; it is not a cross-device atomic merge or a cloud synchronization service. Preserve that recovery folder when backing up the plugin. See [module ownership and recovery contracts](docs/enhancement-modules.md) and the [0.5.0 implementation and acceptance record](docs/implementation-0.5.0-2026-10-02.md).

OpenCodian integration is optional. It is available only when its plugin and the two public commands needed to add the generated context note and open its view are present; no third-party private API is guessed.
