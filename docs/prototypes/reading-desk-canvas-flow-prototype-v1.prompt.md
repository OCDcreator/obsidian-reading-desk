# Reading Desk Canvas Flow Prototype v1

## Reference analysis

PDF Flow's defining interaction is a source-to-canvas flow:

- select text in the PDF;
- drag the selection to the adjacent Canvas leaf;
- create a native Canvas text node with an optional title;
- persist the PDF highlight, page link, chapter path, color, and comment affordance;
- let the user fold, connect, rearrange, and revisit the node;
- double-click the PDF highlight to focus the Canvas node, or click the node's source link to return to the PDF.

Reading Desk already has the corresponding write path and runtime evidence. The previous v2 image underrepresented it by showing an excerpt list inside a plugin panel. This prototype must show the real integration boundary: the right side is an Obsidian Canvas target surface, not a duplicated plugin panel.

## Gimg edit prompt

Use case: ui-mockup
Asset type: high-fidelity desktop Obsidian reader plus native Canvas integration prototype for developer reference
Input images: Image 1 is the current Reading Desk v2 prototype and is the base layout; Images 2–6 are PDF Flow workflow references for drag-to-Canvas, card organization, auto-height, card titles, and PDF↔Canvas linking. Use them for interaction and information architecture only; do not copy their watermark, subtitles, pink/red branding, or exact UI.

Primary request: Edit the current Reading Desk v2 prototype to make the Canvas card-generation workflow visibly real. Preserve the light Obsidian host, left “缩略图 / 目录” switcher with “目录” selected, the PDF paper and highlighted passages, the toolbar including both “适合宽度” and “适合高度”, and the calm Reading Desk design system. Replace the right “摘录目标” list panel with a real-looking adjacent Obsidian Canvas leaf.

Composition:
- Keep a compact Obsidian leaf/tab header and one reader toolbar across the top.
- Far left: a narrow PDF navigation panel with two tabs “缩略图” and “目录”; “目录” is active. Show a small outline tree with “第一章 认知与行动”, “1.1 认知的基本过程”, “1.2 行动与反馈的循环机制” selected, and “1.3 环境与个体的相互作用”, with page references p.38, p.40, p.42, p.47.
- Center-left: a large warm-white PDF page showing a Chinese academic article. Show three text highlights in muted moss, amber, and plum. The selected moss highlight has a small circular comment affordance at the end and a subtle focus outline. The current page indicator is “第 42 / 286 页”.
- Right: a broad, clearly separate native Obsidian Canvas leaf titled “研究笔记.canvas”. Use a very light dotted Canvas grid, native-looking zoom/fit controls at the edge, and generous open space around nodes. Do not make this look like a plugin card list or a dashboard.
- On the Canvas, show one chapter node near the upper-left titled “第一章 认知与行动”, with a compact source link “PDF p.38”. Connect it with a thin curved edge to three Reading Desk excerpt nodes arranged in a loose vertical / branching structure. These are real Canvas text cards, not equal-height tiles.
- Excerpt card 1 is moss green and selected with a blue focus outline. It has an editable title bar “行动与反馈”, body text “行动不是意志的结果，而是环境与反馈共同塑造的过程。”, a source link “原文第 42 页”, a small tag “方法论”, and a “评论 +” affordance.
- Excerpt card 2 is amber and taller because it contains a longer excerpt. It has title “反馈回路”, body text about repeated feedback shaping action, a source link “原文第 42 页”, and a compact “折叠卡片” control.
- Excerpt card 3 is plum and visibly folded to a short title-only state labeled “环境与行动”, with a small disclosure / expand control. It remains connected to the chapter node.
- Show one small, restrained drag/drop completion notice near the selected card: “已创建 Canvas 卡片”. It must read like a transient product status, not a marketing toast. Do not show a giant arrow or cartoon cursor.
- Make the relationship obvious: highlighted PDF text and its Canvas card share the moss color; the Canvas card's source link clearly points back to the PDF. Keep the existing comment popover closed so the Canvas nodes remain the focus.

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
“研究笔记.canvas”
“PDF p.38”
“行动与反馈”
“行动不是意志的结果，而是环境与反馈共同塑造的过程。”
“原文第 42 页”
“方法论”
“评论 +”
“反馈回路”
“折叠卡片”
“环境与行动”
“已创建 Canvas 卡片”

Style/medium: realistic shippable product UI screenshot, production UI reference, not concept art, no device mockup, no marketing board.

Visual system: quiet warm-neutral Obsidian host surface; warm paper only for the PDF; deep charcoal ink; restrained research blue; semantic moss, amber, brick, indigo, and plum; inherited sans-serif; 25/20/16 hierarchy with 14/12 metadata; 24/16/8 spacing; 1px borders; square structural containers; 5px control radius; 2px PDF highlight corners; pill tags; thin-line icons; restrained functional shadows only on paper and detached overlays.

Constraints: the Canvas must be visibly a real dotted working surface, not a list or fake plugin panel; preserve the PDF↔Canvas split; no duplicate “摘录目标” sidebar; no mind-map illustration; no equal-height cards; no gradients; no glassmorphism; no decorative glow; no thick colored side bars; no saturated pills; no pink theme; no Bilibili logo; no watermark; no video subtitles; no garbled pseudo-text; no fake analytics; no generic lorem ipsum; no extra unrelated panels.
