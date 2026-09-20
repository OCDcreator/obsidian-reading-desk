Use case: ui-mockup
Asset type: high-fidelity desktop frontend style reference for an Obsidian plugin bookshelf

Primary request:
Create one polished 1536x1024 desktop UI mockup for the Reading Desk plugin, shown inside a restrained Obsidian dark-theme workspace. The result is a practical frontend specification, not concept art. It should feel like a calm research instrument used for long-form PDF reading.

Reference images:
- Image 1: PDF Ebookshelf card-view structure reference only: cover-led cards, metadata and thin progress indicators.
- Image 2: PDF Ebookshelf category organization reference only: view switch and grouped library hierarchy.
- Image 3: PDF Ebookshelf table-view information-density reference only.
- Image 4: current Reading Desk implementation reference for product identity and Obsidian host context; improve its hierarchy and density substantially.

Layout and hierarchy:
- A narrow Obsidian navigation rail and a quiet top tab bar provide host context, but the Reading Desk surface occupies almost the entire canvas.
- Main content has 24 px outer padding and a centered maximum width around 1320 px.
- Top row: large Chinese title "书架"; subtle supporting copy "原文、摘录与进度在同一处"; compact right-aligned controls "扫描书库", "导入", and an icon-only more button.
- Second row: a wide search field with placeholder "搜索书名、作者或标签"; a segmented switch "卡片" / "表格", with "卡片" selected.
- First content section is "继续阅读", a compact horizontal rail of three smaller cover-led items. Each item shows title and a thin progress line with exact percentage. Do not render full metadata editors here.
- Category row: compact chips "全部 18", "学术研究 6", "设计方法 4", "文学 5", "未分类 3". "全部 18" is selected with an accent outline, not a filled neon pill.
- Main section heading "全部图书" with muted text "18 本 · 按最近阅读排序".
- Main library is a five-column responsive grid of realistic book cards. Each card has a 0.7 portrait cover, then a separate metadata area below the cover: book title, author, page count and file size on one muted line, then a 3 px reading-progress track with percentage aligned at the right.
- One card is keyboard-focused using a clear accent outline. Another shows a very small category marker. Keep cards content-driven rather than equal-height marketing tiles.

Example book data to render naturally:
- "设计中的设计" — 原研哉 — 244 页 — 18.6 MB — 64%
- "如何阅读一本书" — 莫提默·艾德勒 — 426 页 — 12.4 MB — 38%
- "认知觉醒" — 周岭 — 275 页 — 8.9 MB — 72%
- "机器学习基础" — Xiaogang Wang — 218 页 — 6.3 MB — 12%
- "局外人" — 阿尔贝·加缪 — 185 页 — 2.2 MB — 8%

Visual system:
- Host-first Obsidian palette: near-black navy primary surface, slightly lighter secondary surface, soft cool-white primary text, blue-gray muted text, hairline cool-gray borders, one restrained cyan-blue interactive accent.
- Flat, square, precise research-tool character. Controls may use 5 px corner radius; card containers remain nearly square with 0 to 2 px radius.
- Inherit a clean desktop UI sans-serif. Strong hierarchy at approximately 25 px, 20 px, 16 px, 14 px and 12 px.
- 24 / 16 / 8 px spacing rhythm. Dense but breathable.
- Book covers are authored editorial cover designs with varied muted colors; they are content, not UI decoration. Keep cover typography plausible and free of external logos.
- Thin 3 px progress lines; no progress rings and no large KPI numbers.
- Subtle functional shadow only beneath book cover paper surfaces; no shadows on ordinary controls or cards.

Exact text that must be legible:
"书架"
"原文、摘录与进度在同一处"
"扫描书库"
"导入"
"搜索书名、作者或标签"
"卡片"
"表格"
"继续阅读"
"全部 18"
"学术研究 6"
"设计方法 4"
"文学 5"
"未分类 3"
"全部图书"
"18 本 · 按最近阅读排序"

Constraints:
- Preserve the useful bookshelf mechanisms from the references, but do not reproduce their branding, watermark, subtitles, source book covers, banner photograph or exact visual styling.
- The mockup must be feasible with vanilla HTML/CSS and Obsidian CSS variables.
- No light theme, no modal, no open dropdown, no cursor, no annotations, no device frame.

Avoid:
bilibili logo, video watermark, subtitles, copied source covers, hero banner, photography across the top, glassmorphism, blur decoration, gradients in the application chrome, neon category pills, emoji, generic dashboard metrics, oversized empty space, rounded marketing cards, excessive shadow, decorative glow, illegible microtext, fake lorem ipsum, floating prototype controls, watermark.
