# 书架 A/B/C 改版布局测量证据

- 采集时间:2026-09-20 23:50–2026-09-21 00:5x(本地;含评审修复轮复测)
- 宿主:Obsidian 1.13.7,testvault,Reading Desk Margin v0.2.0 build 0.2.0+2026-09-20T15:46:49.744Z(首轮)/ 0.2.0+2026-09-20T16:5x(修复轮)
- 方法:CDP `getComputedStyle` / `getBoundingClientRect`(obsidian eval,主窗口书架 leaf)
- 截图目录:`docs/self-check/shelf-rework-screens/`(17 帧,浅/暗 × A/B/C × 场景)

## A 卡片布局(浅色,卡片态)

```json
{
  "container": { "frameWidth": 732.06", "frameMaxWidth": "1368px", "framePadding": "24px 24px 72px(≤880 容器降 16px 16px 56px)", "note": "leaf 宽 732 < 1368 上限,居中生效" },
  "typography": { "page": "25px", "section": "20px", "card": "16px", "body": "14px", "meta": "12px", "badge": "12px(--font-ui-smaller 在本宿主解析为 12px)", "valueFont": "12px", "valueNumeric": "tabular-nums" },
  "rhythm": { "gridGap": "16px", "railGap": "16px", "chipsGap": "8px", "detailsGap": "7px(登记的微节奏)", "railColumns": "2 × 358px(容器 <1180,窄屏两列生效)" },
  "cover": { "aspect": "0.7000", "coverShadow": "oklch(0.2 0.02 250 / 0.2) 0px 8px 22px(唯一功能性阴影)", "badgeRadius": "999px", "cardRadius": "0px", "cardShadow": "none" },
  "progress": { "height": "3px", "fillTransform": "scaleX(0.9333)" },
  "titleSlot": { "clamp": "2", "slotMinHeight": "41.6px(2.6em)", "longRectHeight": "41.59", "longClamped": true, "shortRectHeight": "41.59(空槽同样占位,保证等高)" },
  "equalHeights": ["466.9", "466.9", "466.9", "466.9", "466.9"],
  "continueRail": { "coverWidth": 88, "coverMinHeight": "118px", "cardCols": "88px 143.35px" },
  "authorLine": { "placeholderWidth": "96px / detailsWidth 231px(fit-content 贴文本)", "focusOutlineRule": "2px accent + 2px offset" }
}
```

## C 台账与 B 导航

```json
{
  "ledger": { "summaryColumns": "4 × 182.52px(≤880 容器降 2 × 2)", "ledgerCoverWidth": 42, "ledgerCoverBorder": "1px", "cellPadding": "10px 12px", "titleClip": "display:block + text-align:left + ellipsis(client 166 < scroll 523,左起截断)" },
  "navigation": { "navColumns": "224px 484.06px(≤880 容器单列+侧栏转横排)", "sidebarPosition": "sticky", "focusColumns": "172px 258.06px", "focusCoverWidth": 172, "focusButtonWidth": "78px(align-self: flex-start)", "compactColumns": "3 × 233px(容器 <1180;宽容器为 4 列)", "selectedInset": "inset 2px(accent 为宿主当前主题 accent)" }
}
```

## 契约对照结论

| 契约项 | 实测 | 判定 |
|---|---|---|
| 内容 max-width 1368px 居中,外层 24px | frameMaxWidth 1368,padding 24/24/72 | 通过 |
| 节奏 24/16/8 | grid/rail gap 16,chips gap 8,details 7(登记微节奏) | 通过 |
| 字号 25/20/16/14/12 | 全部命中;badge 走宿主 --font-ui-smaller | 通过 |
| 封面 aspect 0.7 | 0.7000 | 通过 |
| 进度 3px + 右端百分比 tabular-nums | height 3px;valueNumeric tabular-nums | 通过 |
| 书名恰好两行截断 | clamp 2;长题 scrollHeight>clientHeight;槽 2.6em=41.6px | 通过 |
| 全行卡片等高 | 5 卡均 466.9px | 通过 |
| 卡面无影、封面功能阴影 | cardShadow none;cover 0 8px 22px elevation | 通过 |
| B:224px sticky 侧栏 + 172px 重点卡 + 四列 | 224/sticky/172/4×109.02 | 通过 |
| C:统计 4 格 + 42px 小封面 | 4×182.52/42px | 通过 |

## impeccable detect

- 命令:项目本地 impeccable `detect --json src/views/ShelfView.ts src/views/ShelfItemView.ts src/views/shelf/ assets/styles.css`
- 首轮:0 findings、4 advisory(封面角标白边/白字、台账路径 11px、modal 遮罩黑)→ 全部按规范登记进 DESIGN.md frontmatter(colors: cover-badge-*、modal-scrim;typography: path 11px)
- 复测:`total: 0`,清零
