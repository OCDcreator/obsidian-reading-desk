# Reading Desk UI Prototype v2

## Revision notes

This version corrects two navigation omissions in v1:

1. The left PDF navigation rail is explicitly a two-mode switcher: **缩略图** and **目录**. The screenshot must show **目录** as the active mode, with a readable hierarchical outline and page numbers. Keep a compact way to switch back to 缩略图.
2. The reader toolbar must include both **适合宽度** and **适合高度** as separate, visible controls. Do not omit 适合高度 and do not merge the two into an unlabeled icon.

## Gimg edit prompt

Use case: ui-mockup
Asset type: high-fidelity revision of a desktop Obsidian plugin front-end prototype
Input images: Image 1 is the current Reading Desk v1 prototype and must be preserved as the base layout; Image 2 is a workflow reference for a chapter outline beside a PDF, but its old branding, subtitles, and watermark must not be copied.

Primary request: Edit the current Reading Desk prototype into v2. Preserve the successful visual hierarchy, light Obsidian host surface, PDF paper, right-side 摘录目标 panel, highlighted source text, excerpt cards, and comment popover. Make only the following structural corrections: turn the left PDF navigation rail into a visible “缩略图 / 目录” tab switcher with “目录” selected, and add a clearly labeled “适合高度” toolbar control next to “适合宽度”.

Composition corrections:
- On the far left of the reader, replace the thumbnail-only rail with a narrow navigation panel. At its top show two compact tabs: “缩略图” and “目录”; “目录” is selected with a restrained blue focus/active outline, while “缩略图” remains available as an inactive tab.
- In the active directory panel show a clean tree with indented rows and disclosure chevrons: “第一章 认知与行动”, “1.1 认知的基本过程”, “1.2 行动与反馈的循环机制” (selected), and “1.3 环境与个体的相互作用”. Include small page references “p. 38”, “p. 40”, “p. 42”, “p. 47” aligned to the right. The directory must look like a real PDF outline, not a mind map and not a second Canvas.
- Keep the central PDF paper and right target panel at the same proportions as v1. The selected directory row should align with the current PDF page 42 and visually connect navigation to reading.
- In the toolbar, retain “目标”, “高亮列表”, “裁剪”, “适合宽度”, “第 42 / 286 页”, and the semantic color palette. Add a separate compact control immediately after “适合宽度” labeled exactly “适合高度”. Both controls must be visible simultaneously and clearly distinct.

Exact visible interface text, render legibly and verbatim where shown:
“Reading Desk 阅读器”
“目标”
“高亮列表”
“裁剪”
“适合宽度”
“适合高度”
“第 42 / 286 页”
“缩略图”
“目录”
“第一章 认知与行动”
“1.1 认知的基本过程”
“1.2 行动与反馈的循环机制”
“1.3 环境与个体的相互作用”
“摘录目标”
“Canvas · 研究笔记.canvas”
“打开实际目标”
“本页摘录”
“评论与标注”
“高亮颜色”
“方法论”
“添加评论”

Style/medium: realistic shippable product UI screenshot, not concept art, no device mockup, no marketing board.

Visual system: keep the v1 Reading Desk system exactly—quiet warm-neutral Obsidian host surface, warm PDF paper, deep charcoal ink, restrained research blue, moss/amber/brick/indigo/plum semantic highlights, 25/20/16 heading scale, 14/12 body/meta scale, 24/16/8 spacing, 1px borders, square structural containers, 5px control radius, 2px highlight corners, pill tags, thin-line icons.

Constraints: preserve v1's successful three-zone reader; no extra full-width panel; no mind-map illustration; no duplicated Canvas; no gradients; no glassmorphism; no decorative glow; no thick colored side bars; no saturated category pills; no pink theme; no Bilibili logo; no watermark; no video subtitles; no garbled text; no fake analytics; no giant rounded rectangles. Do not remove or hide “适合宽度”; “适合宽度” and “适合高度” must both remain visible.
