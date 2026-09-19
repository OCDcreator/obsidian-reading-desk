# Phase 0 checkpoint — 2026-09-18

## 已完成且有证据

- 新仓库与允许继承的工具链建立；旧 `../obsidian-bookshelf` 基线仍为 `3d2dc9f`，首次与复核 SHA-256 未变。
- 独立 70 图观察汇总为 `docs/control-map.md`：418 行、70/70 覆盖。
- `PRODUCT.md`、`DESIGN.md`、四个 ADR 与决策日志已经建立。
- 初版共享 contracts、LibraryIndex、AnnotationStore、PDF.js 4.10.38 renderer、真实目标文件 adapters、OSS/COS 签名、导入导出、ShelfView 已实现。
- `npm run verify` 于 22:21 实际通过：lint 0 warning、Vitest 33/33、TypeScript/esbuild build。原始终端输出 `.verify-phase0.log`。
- 本机 Test Vault 初次部署的四件产物 SHA 记录于 `.build-sha256.txt`；启动日志已实测：`[Reading Desk] Margin v0.1.0 build 0.1.0+2026-09-18T14:21:03.857Z`。

## 未完成 / 不得宣称通过

- P0 Reader 的真实 PDF 打开当前被 `ItemView.open` 方法名碰撞阻断；已改名 `openPdf`，但重载时遗留 leaf 仍需清理后重新验证。
- P0 摘录只有右键的初版；缺 split 目标面板、拖拽、色盘、评论锚定浮层、标签补全、换色/删除 UI、真正裁剪、章节 outline 与稳定 target focus。
- P2/P3 服务大多未连接到用户入口；AI bridge 尚无已声明的兼容 provider，真实上传因没有凭据只能 BLOCKED。
- 独立视觉负责人已写 `docs/self-check/visual-preflight.md`，这是缺口清单而不是验收通过。
- 数据层 gate 的 repository 失败恢复、EPUB cover、XMP 数组/XML 实体回归由独占 worker 修复中。

## 下一条命令

```bash
npm run verify && npm run build
```
