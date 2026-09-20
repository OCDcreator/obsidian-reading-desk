# Reading Desk UI Prototype v1

## Reference analysis

The PDF Flow screenshots are strongest when they expose one continuous research action rather than a collection of features:

- The desktop workspace keeps the source PDF and the editable destination visible at the same time. The user's eye can move directly from source passage to extracted note.
- A highlight, its end-of-line comment affordance, and its destination card share one color identity. This makes the bidirectional link understandable before the user reads any help text.
- The top toolbar is compact and task-oriented: target, highlights, crop, palette, zoom, and page navigation. Secondary work lives in anchored drawers or popovers instead of full-page dialogs.
- Canvas cards use real excerpt length, optional title bars, page links, comments, and chapter grouping. Card height follows content rather than a decorative equal-height grid.
- The bookshelf works as an entrance, not as the reading surface. Card and table views expose metadata, progress, classification, and inline editing, then hand off to the reader.

The screenshots also contain traits that should not be copied: Bilibili subtitles and watermarks, saturated category pills, theme-specific pink/red chrome, promotional book photography, and a simulated Canvas inside the plugin. Reading Desk should retain the workflow while using its established host-first design system.

## Adapted direction

Create one high-fidelity desktop reader screen named **Reading Desk 阅读器**. Treat it as a calm research instrument in daylight: compact, precise, warm-neutral, and native to Obsidian. The prototype must prove the product's distinctive mechanism in one viewport: a PDF passage is highlighted, linked to a structured target excerpt, and open for annotation.

## Gimg prompt

Use case: ui-mockup
Asset type: high-fidelity desktop Obsidian plugin front-end style prototype for developer implementation reference

Primary request: Create a realistic, shippable-looking desktop UI screenshot for “Reading Desk 阅读器”, an Obsidian plugin for anchored PDF reading and bidirectional excerpts. Use the supplied PDF Flow screenshots only as workflow and information-architecture references, and use the supplied Reading Desk screenshot as the current product reference. Redesign the surface into Reading Desk's established “daylight research instrument” system; do not copy the old plugin's branding, colors, subtitles, watermark, or exact screen.

Scene/backdrop: full-bleed Obsidian desktop workspace in light mode, no device mockup, no surrounding desk, no browser frame, no marketing presentation board.

Main composition:
- A thin, restrained Obsidian tab and leaf header at the top, followed by one compact sticky reader toolbar.
- The reader workspace is the dominant subject. Inside it, use a narrow document outline/thumbnail rail, a large central PDF paper surface, and a 32% right-side Reading Desk target panel. Maintain generous but practical desktop proportions and crisp alignment.
- The toolbar contains compact icon-plus-label controls for target selection, highlight list, crop, fit width, zoom, page navigation, and a five-color semantic palette. It must read as a real tool row, not a row of oversized pills.
- The PDF page shows a clean Chinese academic article with a clear heading and readable paragraphs. Show three anchored highlights in muted moss, amber, and plum at about one-third opacity. The selected moss highlight has a small circular comment icon at its end and a visible keyboard-focus ring.
- The right target panel is titled “摘录目标”. Show “Canvas · 研究笔记.canvas”, a compact “打开实际目标” control, a chapter outline named “第一章 认知与行动”, and a “本页摘录” list. Include three excerpt cards of different natural heights. Each card has an optional title bar, excerpt text, page-link metadata, tags, and small controls “折叠卡片” and “定位原文”. Their subtle tinted surfaces correspond to the PDF highlight colors without using color as the only state cue.
- Open one anchored comment popover from the selected highlight, placed so it does not hide the main text. It contains the title “评论与标注”, actions “跳转到此高亮” and “删除此高亮”, a labeled “高亮颜色” row with five compact color choices, one tag chip “方法论”, a “评论列表” entry with timestamp “2026/09/20 14:32”, a textarea labeled “记录你的想法”, and the button “添加评论”.

Exact visible interface text, render verbatim and legibly where shown:
“Reading Desk 阅读器”
“目标”
“高亮列表”
“裁剪”
“适合宽度”
“第 42 / 286 页”
“摘录目标”
“Canvas · 研究笔记.canvas”
“打开实际目标”
“第一章 认知与行动”
“本页摘录”
“行动与反馈”
“行动不是意志的结果，而是环境与反馈共同塑造的过程。”
“折叠卡片”
“定位原文”
“评论与标注”
“跳转到此高亮”
“删除此高亮”
“高亮颜色”
“标签”
“方法论”
“评论列表”
“重读时发现，这一段其实在讨论反馈回路。”
“2026/09/20 14:32”
“记录你的想法”
“添加评论”

Style/medium: realistic product UI screenshot, production-ready interface design, not concept art, not an illustration, no isometric view.

Visual system:
- Inherit an Obsidian-like interface sans serif; strong but restrained hierarchy at roughly 25/20/16px for major headings and 14/12px for body and metadata.
- Warm paper white for the PDF only; host surfaces are quiet warm-neutral gray-white. Ink is deep charcoal, muted text is cool gray, and the primary action/focus accent is restrained research blue.
- Semantic highlight colors are moss green, amber, brick, indigo, and plum; use them sparingly and consistently across PDF highlight, palette, and excerpt card.
- Spacing rhythm: 24px workspace, 16px panel, 8px compact groups, with only the smaller 4/8/12/16/20/24 scale.
- Flat, square structural containers with 1px borders. Ordinary buttons and inputs use only 5px corner radius. Highlight corners are 2px. Tags are pills. Color controls and comment affordance are circular.
- Use shadow only for the PDF paper and the detached comment popover; no shadows on ordinary cards.
- Use one consistent thin-line icon family, not emoji and not text glyphs.
- Make every control state understandable through label, icon, outline, or shape in addition to color. Show visible focus treatment and high contrast.

Constraints: practical layout; realistic density for a researcher; readable Chinese typography; coherent full window; no extra panels; no dashboard metrics; no fake analytics; no equal-height marketing cards; no gradients; no glassmorphism; no decorative glow; no thick colored side bars; no giant rounded rectangles; no Bilibili logo; no watermark; no video subtitles; no branding from PDF Flow; no pink theme; no duplicated Obsidian Canvas surface; no lorem ipsum; no garbled pseudo-text; no English UI labels except “Reading Desk”, “Canvas”, and the file extension.
