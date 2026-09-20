# Reading Desk 书架视觉原型

> Throwaway prototype：用于确认前端结构与视觉方向，不是可直接合并的生产实现。

## 原型问题

在保留 PDF Ebookshelf 的封面墙、阅读进度、分类和表格信息密度的前提下，Reading Desk 的书架应该采用什么结构，才能符合现有的 Obsidian 宿主优先设计系统？

## 成果

- `reading-desk-bookshelf-contact-sheet.png`：四种结果总览；左上为 GIMG，右上为 HTML A，左下为 HTML B，右下为 HTML C。
- `reading-desk-bookshelf-gimg-v1.png`：`gimg` 高保真目标图，适合确认整体完成度、真实封面密度和最终观感。
- `reading-desk-bookshelf-html-a.png`：A，紧凑研究书架。继续阅读横轨 + 分类 chips + 五列封面墙。
- `reading-desk-bookshelf-html-b.png`：B，分类导航工作台。左侧分类导航 + 当前阅读重点 + 四列书架。
- `reading-desk-bookshelf-html-c.png`：C，书目台账。统计摘要 + 高密度表格，适合元数据整理。
- `reading-desk-bookshelf-prototype.html`：三种结构共用的可运行单文件原型。
- `reading-desk-bookshelf-gimg-v1.prompt.md`：`gimg` 最终提示词与约束。

## 推荐

建议以 A 作为默认卡片视图，以 C 作为现有“表格视图”的结构目标。B 可以保留为大书库或分类数量显著增加时的候选，不建议现在作为默认界面。

## 前端样式契约

- 外层工作区：`24px` padding，最大内容宽度约 `1368px`。
- 结构节奏：工作区 `24px`、面板 `16px`、紧凑间距 `8px`。
- 标题层级：`25 / 20 / 16 / 14 / 12px`。
- 书架网格：宽屏五列；生产实现继续使用 `repeat(auto-fill, minmax(184px, 1fr))`。
- 封面比例：`aspect-ratio: 0.7`；封面和元数据分层，不使用 PDF Ebookshelf 的底部模糊文字遮罩。
- 卡片容器：方正、`1px` 宿主边线、无装饰阴影；只有封面纸面允许功能性阴影。
- 继续阅读：三张紧凑横卡，只显示封面、书名、作者与进度，不显示分类编辑器。
- 分类：单行可换行 chips，选中态使用 accent 边线和 focus outline，不使用高饱和霓虹填充。
- 阅读进度：`3px` 细线，百分比右对齐并使用 tabular numerals。
- 颜色：生产代码必须继续使用 `--background-primary`、`--background-secondary`、`--text-normal`、`--text-muted`、`--background-modifier-border` 和 `--interactive-accent`。
- 响应式：低于约 `1180px` 时四列；低于约 `880px` 时三列，并让工具栏换行。

## 运行

直接在浏览器打开 HTML，通过 URL 参数切换：

```text
reading-desk-bookshelf-prototype.html?variant=A
reading-desk-bookshelf-prototype.html?variant=B
reading-desk-bookshelf-prototype.html?variant=C
```

也可以使用页面底部的左右按钮或键盘方向键切换。截图时追加 `&capture=1` 隐藏原型切换栏。

## 边界

- 参考图只用于提取布局机制，没有复用 PDF Ebookshelf 的品牌、视频水印、横幅照片、源封面或现成 SVG。
- 本轮没有修改 `src/`、`styles.css`、构建产物或 Test Vault。
