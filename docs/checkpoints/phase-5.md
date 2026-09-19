# Phase 5 checkpoint — 2026-09-18

## Actual evidence

- AI detection uses an explicit OpenCodian bridge only when the plugin is enabled and its required public commands exist; no private third-party API is assumed.
- Legacy import enumerates real per-book metadata at `.obsidian/plugins/bookshelf/metadata/*.json`; an absent source raises without consuming the one-time import state.
- Markdown and JSON export have both settings-panel and command-palette entry points.

## 收尾状态（2026-09-19 本地）

- 本地版本已按收尾流程 bump 到 0.1.1，完整 verify、四产物顺序部署、SHA-256 和启动首行证据均索引于 `docs/final-dod-evidence.md`。
- 最终视觉确认仍在冻结的 0.1.1 build 上执行；这不是本 checkpoint 的通过声明。
- OSS/COS 真实 PUT/read 仍缺用户凭据，是唯一外部验证边界；其余本地缺口应以功能/视觉 gate 的最终报告为准。

## Next command

```bash
npm run verify
```
