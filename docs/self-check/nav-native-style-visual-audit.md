# 导航面板原生样式对齐 · 视觉与行为自检

- 分支/构建:`zcode/nav-native-thumbnail-style`(worktree `~/zcode-worktrees/obsidian-reading-desk/nav-native-thumbnail-style`),基线 origin/main 01140e4,版本 0.2.0。
- 范围:PDF 导航 leaf 的缩略图视觉契约对齐宿主原生 PDF 侧栏(PDF++ 所呈样式),目录/缩略图对当前位置的持续定位。
- 验证时间:2026-09-20;宿主 Obsidian 1.13.7,testvault(cheery 粉浅色主题 + 注入 `theme-dark` 的暗色核验)。

## 行为断言(CDP/CLI eval,非仅目测)

| 断言 | 结果 |
| --- | --- |
| 缩略图按钮带 `data-page-label`,`::after` 徽章 content 渲染页码 | PASS(首次截图轮 `badgeContent:"\"1\"`) |
| 懒渲染纸面完成标 `data-rendered`,未渲染为 1px 虚线占位 | PASS(`renderedCanvases` 随滚动增长) |
| 计算样式:边框 8px 透明、背景透明、无按钮阴影;纸面 148px + `--pdf-thumbnail-shadow` | PASS(nav-recheck 探针) |
| 目录范围匹配:第 7 页(Chapter 2 Beta p.5–p.11 区间内部)→ 唯一高亮 Beta;第 28 页(Chapter 5 Epsilon p.26 起内部)→ 唯一高亮 Epsilon | PASS(nav-outline-assertion;旧精确匹配逻辑在这两页均无高亮) |
| li `fit-content` + flex-wrap 居中;窄面板单列、宽面板多列换行 | PASS(liWidth 164 = 148+2×8) |
| 页签选中态恢复(accent 边+浅混色),未选中静默透明 | PASS(复拍 cdp-outline-light) |
| 目录行清除主题 `--input-shadow` 描边环(评审 P0) | PASS(复拍,行呈扁平原生 nav 样式) |

## 验收流程记录

- `npm run verify` 全绿(156 tests,含 8 项新样式契约);owner-guard 650 行门禁内(ReaderView 649 未动)。
- impeccable detect(assets/styles.css + ReaderNavigation.ts):0 发现;4px/3px 刻度登记进 DESIGN.md frontmatter `rounded:` 块(thumbnail-halo/thumbnail-badge)。
- 独立设计评审(未见检测输出):P0 目录行主题描边环已修;P1 页签词汇/leaf 切换全量重建、P2 缩略图键盘网格导航与 revealPage O(n) 为遗留跟进项(改前即存在,非本次引入)。
- 截图证据:`/Volumes/SDD2T/obsidian-vault-write/testvault/.obsidian-debug/nav-native-style/cdp-*.png`(CDP 元素级截帧)。
- 采集坑:`obsidian dev:screenshot` 在本轮持续回放陈旧缓存帧(不同状态产出同哈希),实机视觉证据一律改用 `obsidian_cdp_capture_ui.mjs` 的 CDP `--selector` 截帧。
- 测试 fixture:`Reading Desk Fixtures/outline-range-fixture.pdf`(30 页,两级目录,章节跨 4–8 页)由脚本生成,供范围匹配回归使用。
