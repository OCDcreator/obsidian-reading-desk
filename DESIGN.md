---
name: "Reading Desk"
description: "融入 Obsidian 主题的密集研究阅读与摘录工作台。"
colors:
  surface: "var(--background-primary, oklch(0.98 0.005 250))"
  surface-raised: "var(--background-secondary, oklch(0.96 0.01 250))"
  surface-document-light: "oklch(0.985 0.006 90)"
  surface-document-dark: "oklch(0.22 0.012 75)"
  ink: "var(--text-normal, oklch(0.24 0.02 250))"
  ink-muted: "var(--text-muted, oklch(0.48 0.02 250))"
  line: "var(--background-modifier-border, oklch(0.75 0.02 250))"
  accent-light: "var(--interactive-accent, oklch(0.62 0.13 235))"
  accent-dark: "var(--interactive-accent, oklch(0.62 0.13 235))"
  moss: "var(--canvas-color-4, oklch(0.68 0.12 145))"
  amber: "var(--canvas-color-3, oklch(0.77 0.14 80))"
  brick: "var(--canvas-color-1, oklch(0.62 0.15 30))"
  indigo: "var(--canvas-color-6, oklch(0.61 0.13 275))"
  plum: "var(--canvas-color-5, oklch(0.62 0.13 325))"
  elevation: "oklch(0.2 0.02 250 / 0.2)"
typography:
  page:
    fontFamily: "inherit"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.25
  section:
    fontFamily: "inherit"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
  card:
    fontFamily: "inherit"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "inherit"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "inherit"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  square: "0"
  highlight: "2px"
  control: "5px"
  "control-lg": "6px"
  card: "8px"
  circular: "50%"
  pill: "999px"
spacing:
  tight: "8px"
  panel: "16px"
  workspace: "24px"
components:
  control-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
    height: "30px"
  reader-toolbar:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "12px 16px"
  shelf-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "10px"
  target-panel:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "16px"
  comment-portal:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "12px"
  highlight-row:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "8px 0"
  progress-fill:
    backgroundColor: "{colors.accent-light}"
    rounded: "{rounded.square}"
    height: "3px"
---

# Design System: Reading Desk

## Overview

**Creative North Star: "日光下的研究仪器"**

Reading Desk 是一个 desktop Obsidian 操作表面：像长期置于书桌上的研究工具，安静、紧凑、可预测。秩序来自可检索的书目、PDF 页边、相邻目标和可见的原文锚点，而不是英雄区、生活方式封面或仪表盘式指标。

它不拥有一套脱离宿主的固定明暗主题。插件表面从 Obsidian 的背景、文字、边线和 interactive accent 变量派生；浅色与深色只为 PDF 文档面提供明确覆写。真实 Canvas、Excalidraw 与 Markdown 仍是相邻的原生宿主表面，Reading Desk 只渲染自己的目标面板、锚点和控制，不仿制宿主画布。

**Key Characteristics:**

- 25/20/16 的阅读标题层级，配合 14/12 的正文和元数据，服务密集研究任务。
- 24/16/8 的工作区、面板和紧凑控件节奏；正文与空态说明最多 75ch。间距刻度为 `4/8/12/16/20/24`，不引入刻度外的一次性数值。
- PDF 高亮、Canvas 节点颜色和评论色盘使用同一组语义 palette key；色彩从不单独承担状态含义。
- 锚点、评论、裁剪和章节结构是操作反馈，不是装饰性图形。

`docs/self-check/visual-audit.md` 的 remaining-only 最终候选为 `0.1.1+2026-09-18T17:18:51.094Z`。独立视觉复核已确认 V-03 的窄 split PDF 宽度和 V-06 的主题切换色板对比均 resolved；已登记的 V-01–V-10 缺陷均关闭。这是对既定表面的定点确认，不应被本文件的源码映射误读为全新广度审查或 whole-product ship 结论。

## Colors

所有语义色以当前宿主变量为来源；OKLCH 回退仅在宿主变量不可用时提供稳定值。`surface-document-*` 只属于 PDF/封面内容，不能扩展为插件通用白/黑底。

### Primary

- **Research Accent** (`accent-light` / `accent-dark`): 主操作、选中边界、进度填充与 keyboard focus。直接引用 Obsidian `--interactive-accent`，在浅色与深色主题中都跟随用户选择的原生 accent，仅保留 OKLCH 回退；不能把它铺成大面积背景。

### Secondary

- **Canvas Moss** (`moss`): Canvas native color 4 或其 OKLCH 回退；用于同源高亮与节点色。
- **Canvas Amber** (`amber`): Canvas native color 3 或其 OKLCH 回退；用于同源高亮与节点色。
- **Canvas Brick** (`brick`): Canvas native color 1 或其 OKLCH 回退；用于同源高亮与节点色。
- **Canvas Indigo** (`indigo`): Canvas native color 6 或其 OKLCH 回退；用于同源高亮与节点色。
- **Canvas Plum** (`plum`): Canvas native color 5 或其 OKLCH 回退；用于同源高亮与节点色。

### Neutral

- **Host Surface** (`surface`): Obsidian `--background-primary` 的直接引用，作为 Shelf 和 Reader 的应用底面。
- **Raised Host Surface** (`surface-raised`): Obsidian `--background-secondary` 的直接引用，用于工具栏、卡片、抽屉、目标面板和评论浮层。
- **Document Surface** (`surface-document-light` / `surface-document-dark`): PDF 页与封面的浅/深模式背景；PDF 本身可以保留原有纸白，它不是插件 UI 白色 token。
- **Host Ink / Muted Ink / Line** (`ink`, `ink-muted`, `line`): 分别直接引用 `--text-normal`、`--text-muted`、`--background-modifier-border`，保持与当前 Obsidian 主题一致。

**The Host-First Rule.** 插件通过语义 token 适配宿主；不得把宿主色彩复制为新的固定 hex，也不得在本地覆写 Canvas 原生 palette。评论 portal host 自带 `.reading-desk-shell`，直接继承共享 token 块，深色 raised surface 用 `--background-secondary-alt` 覆写；设置页 `.reading-desk-settings` 同样声明该 token 块，避免脱离 Reader/Shelf 继承树后断链。

**The Shared-Marking Rule.** 一次摘录的 PDF 高亮、色盘选择和 Canvas 节点使用同一 palette key；文字标签、aria-label、焦点环和选中边界同时说明状态。

**The Dynamic Contrast Rule.** Canvas palette 是宿主主题变量，评论 swatch 必须在挂载和宿主主题 class/style 改变后，依据浏览器已解析的实际背景色重新选择带色偏的深/浅前景；不得硬编码某个 palette key 或某一主题的前景。样式表中的 swatch 前景只是 `--rd-ink` 主题回退，实际前景由运行时采样写入。文字与背景在每个实际主题状态下须达到至少 4.5:1。

## Typography

**Display Font:** 继承 Obsidian 当前界面字体。

**Body Font:** 继承 Obsidian 当前界面字体。

**Character:** 字体不另立品牌声部；用稳定的尺寸、粗细和行高让书目、工具和原文锚点在用户的宿主主题中可扫读。

### Hierarchy

- **Page** (600, 25px, 1.25): Shelf 主标题。
- **Section** (600, 20px, 1.25): Shelf 区段与设置分组标题。
- **Card** (500, 16px, 1.25): 书名、目标面板标题和卡片标题。
- **Body** (400, 14px, 1.5): 面板说明和设置说明；说明性文字最大 75ch。
- **Meta** (500, 12px, 1.5): 作者、页数、文件大小、标签和进度语境。

**The 25/20/16 Rule.** 页面、区段、卡片的宏观相邻层级固定为 1.25；14/12 仅用于密集工具和元数据，不能倒灌为主信息层级。

**The Heading-Root Rule.** Shelf 的 `书架` 是可见 `h1`，区段是 `h2`；书名在一格书库网格里不是文档区段，用同字号的非标题元素承载。Reader 的标题已由 Obsidian leaf header 呈现，源码内的 `h1` 只提供语义根，用 `.rd-visually-hidden` 隐藏，避免重复标题。目标面板为 `h2`，其摘录卡片分组为 `h3`，不跳级。

## Layout

Shelf 和 Reader 的外层各保留 `24px` 工作区 padding。Reader 的 sticky 工具栏使用 `12px 16px`，分栏 PDF/目标面板间距为 `16px`；目标面板自身 `16px` padding、`12px` 内部 gap。列表、摘录卡和工具组以 `8px` 为基本节奏。

Shelf 的主书库采用 `repeat(auto-fill, minmax(184px, 1fr))`，卡片不是营销式的固定等高网格：封面容器保持 `0.7` aspect ratio，继续阅读轨单卡限定为 `clamp(152px, 22vw, 196px)` / 最大 `196px`，其余高度由真实元数据、标题与进度决定。表格是数据密集布局，不套用正文行宽规则。

Reader leaf 始终只承载 PDF 工作面，真实 PDF 导航作为独立原生 Obsidian 左侧栏 leaf 呈现，不随 Reader 变窄而挤占中间阅读空间。导航 leaf 在真实页面缩略图与 PDF outline 层级之间切换，并跟随最近激活的 Reader；目录含当前章节、页码、加载、空和错误态。Reader 工具栏保留“PDF 导航”入口，用户折叠宿主左侧栏时导航按宿主行为隐藏，重新打开后仍保留两种页签。PDF 工作面保持 `min-width: 0` 与自身 overflow，不依赖全窗口宽度。

真实 Canvas、Excalidraw 与 Markdown 由宿主相邻 leaf 呈现。创建 Canvas 摘录后 Reader 立即调用宿主打开相邻 Canvas 并聚焦新 node；Reader 内“摘录管理”只是按需打开的辅助 overlay，不占第三列、不模拟 Canvas。高亮抽屉和评论浮层同样是有边界的 overlay。工具栏在窄 leaf 中换行，overlay 偏移读取工具栏实测高度。PDF 页宿主保留自身 `overflow: auto`，避免过宽页面溅出 Reader。

## Elevation & Depth

默认用宿主 surface、1px `line` 和空间分组建立层级，不给 Shelf 卡片增加装饰性阴影。唯一阴影是功能性深度，且只有一档 `--rd-elevation`（`oklch(0.2 0.02 250 / 0.2)`）：PDF 页以 `0 8px 22px` 脱离工作底面，高亮抽屉与评论 portal 以 `0 12px 28px` 表明临时浮层。三处各写一个 alpha 是噪音，不是一个纵深系统。

**The Structural-Only Rule.** 阴影只用于文档纸面和越过滚动/宿主边界的 overlay；卡片、chips 和普通控件保持扁平，以边线、选中边界和空间表达结构。

## Shapes

组件使用克制的方正轮廓：常规 input、select 和按钮是 `5px` 圆角；PDF 高亮是 `2px`，避免在正文上形成胶囊；色盘和高亮末端评论入口是圆形；标签为 `999px` pill。Shelf 卡、目标面板、抽屉与评论容器保持直角容器和 1px 边线。设置页采用 shadcn 视觉变体：设置卡容器 `8px`（card），卡内输入与下拉 `6px`（control-lg），是刻意登记的系统延伸，不回灌到阅读器与书架表面。

**The Native-Tool Rule.** 形状优先服从 Obsidian 控件和真实 PDF/Canvas 工作面；不使用侧色条、渐变文字、装饰玻璃或大数字指标模板。

## Components

### Controls

**紧凑、可键盘识别的原生感控制。** `rd-button`、Reader toolbar 的 select/input、Shelf 与裁剪控件以及评论浮层的 input/textarea 使用 `surface`、`ink`、1px `line`、`5px` 圆角、最小 `30px` 高和 `4px 8px` padding。hover 改变边线为 accent；focus-visible 为 `2px` accent outline 加 `2px` offset；disabled 降低不透明度并改用 muted ink，不响应 hover accent。disabled、loading、empty、error 和 selected 必须有中文文案或形态，不能只换色。

### Shelf Cards and Table

**真实书目优先于宣传封面。** `rd-shelf-card` 使用 raised surface、1px line、`12px` 内边距和 `8px` gap；封面容器不控制书目正文的高度。hover/selected 只以 accent 边线和低比例 accent 混色提示，键盘焦点仍保留 outline。`rd-library-table` 使用行底边、`8px` 单元格 padding 和就地编辑，不把数据行伪装成卡片。继续阅读轨是「继续」入口而不是第二个书架：轨内卡片只保留封面、书名与进度（封面限高 `160px`，不渲染作者、元数据与分类编辑器），分类筛选与新建分类共用一行 wrap 排布。两者叠放会让单本轨道加分类面板吃掉首屏，把主书库挤到折叠线以下。

### Reader Toolbar and Target Panel

**同一个工具词汇连接 PDF 与真实目标。** toolbar 固定在 Reader 顶部，按“目标与摘录 / 标注 / 显示适配 / 页码 / 颜色”组成单行轻量图标；图标继承宿主 ink，没有逐按钮方框或竖向分隔线，分组仅用克制的组间空白表达，组内保持紧凑。语义名称通过中文 tooltip 与 `aria-label` 保留。页码、侧栏入口、适合宽度、适合高度与颜色入口属于核心控制；空间不足时，次级操作进入最右侧原生“更多工具”菜单，不能压缩命中区或换成多行。手动放大/缩小退出 fit mode，Reader 容器重排则保持当前 fit mode。`rd-target-panel` 是按需打开的辅助管理 overlay，含目标类型/路径、摘录卡和明确的原生目标入口；它不占常驻第三列，也不替代或伪装 Canvas/Excalidraw leaf。实际目标由宿主打开、聚焦与保存。

### Highlights, Palette and Comments

**标记颜色是锚点身份，不是唯一状态。** 高亮透明度为 `0.33`，`rd-highlight-row` 以类型、片段、色点、标签和跳转组成两列可换行条目；色点独占第一列，其余（含跳转控件）都归属内容列，否则跳转控件会把 auto 轨道撑到约 196px，把色板挤成竖排。toolbar 色盘是 28px 圆形 palette control，是唯一没有可见文字标签的色控，名称只走 `aria-label`；浮层与抽屉里的 swatch 是带颜色文字的 `52px` 最小宽度、28px 高 control，选中态由 `aria-pressed` 与 accent 轮廓共同表达。高亮末端评论入口是 `24px` 圆形，内含自绘 SVG 气泡而不是文字字符；运行时命中区仍以当前 visual audit 的后续 verdict 为准。

**The Button-Restore Rule.** Obsidian 全局的 `button:not(.clickable-icon)` 以 `(0,1,1)` 指定 `--interactive-normal`，压过插件任何单类名按钮规则。因此 `.rd-button`、`.rd-link`、`.rd-tag__remove`、`.rd-crop-drag-handle`、`.rd-highlight-comment-button` 与 button 载体的 palette key 都必须以带根作用域的复合选择器复述，否则工具栏色盘、抽屉与浮层的色板会全部退化成主题按钮底色，颜色彻底消失。

`CommentPopover` 通过 `ownerDocument.body` 开 portal。portal host 同时带 `.reading-desk-shell` 与其自有 `--rd-*` token，因而能在离开 Reader/Shelf 继承树后继续获得正确的 raised surface、ink、line、accent 与 Canvas palette；浮层有 `fixed` 定位、viewport 尺寸上限和独立滚动，不依赖 PDF 页的 overflow。其 swatch 前景会随宿主主题切换重新采样实际背景色，以保持至少 4.5:1 的文字对比。

### Crop and Chapter Structure

**操作生成真实资料，不制造装饰性占位。** `CropSelectionOverlay` 在实际 PDF 页面上框选，提供取消、拖拽 handle 与按钮替代路径；裁剪数据以 PDF 归一化空间表示，拖拽 payload 在落入目标后才写入。选择/首次写入 Canvas 目标时，Reader 会将当前 PDF 的完整 outline 同步为真实 Canvas chapter 节点，并将摘录按章节归属；章节和摘录仍由目标原生表面呈现。

### Progress

**页码语境下的细线反馈。** `rd-progress` 是 `3px` line 底轨，fill 使用 accent，自身保持 `100%` 宽度并以 `transform: scaleX()` 加 `180ms` 指数 ease-out 做合成器过渡；`prefers-reduced-motion: reduce` 取消过渡。不得改为环形 KPI 或大数字摘要。

## Do's and Don'ts

### Do:

- **Do** 从 Obsidian CSS variables 取得 surface、ink、line 和 primary accent，并保留源码中的 OKLCH fallback。
- **Do** 保持 25/20/16 主层级、24/16/8 空间节奏和说明文字 75ch 上限。
- **Do** 用 Canvas native palette key 同时驱动 PDF 高亮与 Canvas 节点；为色盘提供文字、aria-label、focus 与 selected 边界。
- **Do** 将评论 portal 的自有 token 视为 detached host 的必需基础设施；维持实际原生目标面与 Reading Desk 面板的边界。
- **Do** 让裁剪、拖拽、章节同步、评论与回跳反馈对应真实数据操作。

### Don't:

- **Don't** 把宿主派生颜色重新定义成固定品牌色，或在本地覆盖 Canvas 原生色板。
- **Don't** 使用侧色条卡片、渐变文字、装饰性 glassmorphism、装饰性光晕、emoji 图标或大数字加小标签模板。
- **Don't** 以等高营销卡片、仿制 Canvas/Excalidraw 表面或纯颜色状态替代研究任务的真实层级和宿主语义。
- **Don't** 把 `docs/self-check/visual-audit.md` 的 `fix` 证据升级为已 ship 的视觉验收；未闭事项必须等待对应运行时确认。
