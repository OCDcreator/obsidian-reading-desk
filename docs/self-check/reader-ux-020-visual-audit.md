# Reader UX 0.2.0 实机视觉验收

日期：2026-09-20。构建：`0.2.0+2026-09-20T11:0x` 系列（多次部署，最终四件套 SHA 与 Test Vault 一致）。宿主：macOS Obsidian 1.13.7 `testvault`,真实 Electron surface,CDP 采集。

## 验收方法

- 每张截图前先证明表面就绪:可见 reader 根、当前页 host 非占位且文本层 span 数 > 0;连续滚动帧另断言 ≥2 个已绘制页;暗色帧断言 `data-rd-pdf-invert='on'`;窄幅帧断言 `canvasW ≤ stageW + 4` 且工具栏 `scrollWidth ≤ clientWidth`。
- 两个独立视觉评审代理逐张目测(第一轮发现缺陷→修复→第二轮复核),另有两张关键帧由主代理用图像工具定向复核。
- 机械检测:`impeccable detect --json assets/styles.css src/ui/search/ReaderSearchPanel.ts src/reader/ReaderToolbar.ts src/reader/ReaderPageControl.ts` → `[]`。

## 第一轮发现与修复

| 缺陷 | 根因 | 修复 |
|---|---|---|
| 连续 deck 恰好只画一页(截图空白) | `PdfRenderer.activeRenderTask` 单槽:第 2 页渲染取消第 1 页任务 | 改为按页 Map 跟踪;generation 只随文档开关失效,不再每次渲染自增 |
| 缩放后页宽不更新(窄幅 64% 仍溢出 1160px) | deck `pageWidth` 缓存了首次(当时缩放)宽度;`requestRender` 跳过已渲染页 | 以 scale=1 测自然宽;`relayoutPending` 纪元失效 + 显式重请求可见窗口;`render()` 等当前页绘制完成 |
| 窄幅工具栏裁切(缩放组无溢出收纳) | 新缩放组未挂 `data-rd-overflow` | 整组 `secondary` 溢出 + 更多菜单补 缩小/放大 |
| 梅紫渲成青色 | plum/indigo 与 canvas-color-5/6 对调 | plum→color-6(purple)、indigo→color-5(teal),实机色值 rgb(120,82,238)/rgb(0,191,188) 证实 |
| 搜索结果行高 0(状态有计数但无行) | 搜索面板挂在 root grid,抢占 `minmax(0,1fr)` 行 | root 三行模板 `auto auto 1fr` + 常驻 `.rd-reader-aux` 行承载面板 |

## 第二轮(最终)结果

| 场景 | 证据 | 结论 |
|---|---|---|
| 01 浅色宽幅 | `01-light-wide.png`,文字清晰、色盘五色正确 | PASS |
| 02 连续滚动分界 | `02-light-deck-scrolled.png`(化学书第 12/13 页连排,分界清晰,无灰带) | PASS |
| 03 全文搜索 | `03-light-search.png`(6 行结果、第 N 页前缀、首行选中态;DOM list 高度 200px) | PASS |
| 04 高亮抽屉 | `04-light-drawer.png`(梅紫=purple 修正,锚定工具栏下方) | PASS |
| 05 暗色反相 | `05-dark-invert.png`(纸面反相、外壳不反相、高亮可读;原生窗框浅色系 CDP 强制主题的采集伪影,非插件缺陷) | PASS |
| 06 窄幅 414px | `06-light-narrow.png`(canvas 382==stage 382 适宽、工具栏收纳无裁切) | PASS |

## 遗留(非阻断)

- 窄幅下评论气泡图标 24px 固定,相对小页面对文字遮挡比例偏大(P2,后续可随缩放缩放)。
- 页间距灰带为设计文档允许的纸面投影(`0 8px 22px`),保留。
- `app.setTheme` 在该宿主上不更新 body 类;暗色采集用 body 类注入,只影响验收方式。
