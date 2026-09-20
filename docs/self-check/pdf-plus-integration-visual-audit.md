# PDF++ 首批适配实机视觉审计

结论：**PASS（PDP-001–004）**。实机为 macOS Obsidian 1.13.7 的 `testvault`，最终部署 build `0.1.1+2026-09-19T17:51:19.553Z`。截图来自真实 Electron surface；为精确命中容器断点，部分场景通过 CDP 改变 Electron viewport，不能表述成另一台物理设备。

## 验收方法与边界

- 在正确 `reading-desk-reader` leaf 已挂载、PDF canvas/text layer 完成后截图；没有把空白或错误 surface 当作结果。
- 第 1 轮批量检查了 light/dark、宽/窄、drawer、page empty、长文本、mouse/keyboard preview；发现长摘录的水平溢出并批量返工。
- 确认轮发现宿主固定按钮高度导致多行文本纵向溢出，完成同源确定性修复后，用当前确认流程的 targeted 截图与 box measurement 收口；到此停止视觉微调。
- 实际交互断言见 `pdf-plus-integration-runtime.json`；所有 DOM/computed-style 数据见 `pdf-plus-integration-measurements.json`。Impeccable detector 在主要 UI 实现完成后唯一运行一次，结果 `[]`；其后实机视觉检查又发现并修正了列表缩进、长摘录换行与宿主固定按钮高度，最终状态由本审计中的截图、盒模型测量和静态回归测试覆盖，未重复运行 detector。

## 截图索引

| 场景 | 截图 | 目测结论 |
| --- | --- | --- |
| 改动前 light Reader | `visual-pdf-plus-before-light-reader.png` | 基线：尚无新 scope/copy UI。 |
| light、窄 leaf、全书抽屉 | `visual-pdf-plus-after-light-narrow-drawer-all.png` | scope、计数、两行复制入口、色板与删除层级清楚；无裁切。 |
| mark → row preview | `visual-pdf-plus-after-light-preview-mark-to-row.png` | 多 rect 与唯一行同时以 accent 轮廓标识，不覆盖语义色。 |
| 原生键盘 Tab preview | `visual-pdf-plus-after-light-keyboard-preview.png` | focus 路径进入高亮行时同步 PDF rect；跨到下一行清除旧状态。 |
| light 宽 split（drawer 关闭） | `visual-pdf-plus-after-light-wide-split-uncovered.png` | PDF/真实目标面板保持 16px gap，工具栏换行但控件可达。 |
| dark 801px leaf | `visual-pdf-plus-after-dark-leaf-801-split.png` | 仍为双列，目标列约 241px；无横向溢出。 |
| dark 799px leaf | `visual-pdf-plus-after-dark-leaf-799-stacked.png` | content-driven 800px 断点切到单列，目标面板进入正常流。 |
| dark 761/759 leaf | `visual-pdf-plus-after-dark-leaf-761.png`、`visual-pdf-plus-after-dark-leaf-759.png` | fallback 邻域稳定，PDF 与目标均在 leaf 内。 |
| dark 759px page empty | `visual-pdf-plus-after-dark-759-page-empty.png` | “第 4 页没有高亮”与“查看本书全部”恢复入口明确。 |
| 最终 dark 759px 长文本 | `visual-pdf-plus-after-final-confirm-dark-759-long-row.png` | 全文在按钮内完整多行显示，标签/复制/色板/删除依次下排，无覆盖或水平滚动。 |

## 关键实测

- 宽 split（leaf `911.40px`）：toolbar `12px 16px` padding、body `24px` padding、PDF/target gap `16px`；PDF `570.23px`，目标 `276.28px`。
- 801px：PDF `495.33px`、目标 `241.09px`，两列保持；799px：目标面板移动到 PDF 下方，宽 `775.40px`。
- 761/759px：body padding `12px`、gap `16px`；目标宽分别 `737.40/735.40px`，无真实 overflow。
- 抽屉：宽 `360px`、padding `12px`；scope content 宽 `334px`，gap `8px`；普通行在最终样式下取消 `<ol>` 默认缩进。
- 最终长摘录：row `clientWidth == scrollWidth == 334px`；jump `clientWidth == scrollWidth == 316px`，`clientHeight == scrollHeight == 164px`；drawer `clientWidth == scrollWidth == 358px`。唯一被 overflow 扫描报告的是故意隐藏的 1px 语义标题。
- light/dark 均解析宿主 `--rd-*` token；preview 只使用 accent outline，状态同时由 scope 文案、`aria-pressed`、可见边界表达。

## 功能与可访问性

- 工具栏和 command 均复制 1-based 当前页链接；高亮行复制稳定 `highlightId` 链接。
- 真实协议 handler 使用当前 `LibraryIndex`/`AnnotationStore` 路径覆盖 stale URI path；页面与高亮都打开到正确 Reader。
- clipboard 拒绝时显示中文恢复 Notice；命令在非 Reader surface 为 disabled。
- 全书/当前页 scope 的 `aria-pressed`、计数、空态与恢复入口一致。
- Mouse 双向 preview 与原生 CUA `Tab` focus preview 均通过；跨行后旧 11 rect/row 清理，新 10 rect/row 激活。

## 控制台、恢复与剩余风险

- 最终四件套 SHA 与 Test Vault 完全一致，fresh startup identifier 可见；Reading Desk 最终 error buffer 为 `No errors captured`。右侧 OpenCodian 的既有错误不属于 Reading Desk。
- 临时内存 highlight 已删除，主题恢复 `moonstone`，drawer 关闭，原 Reader 恢复到原 PDF 第 4 页。
- 非 PDP 阻断的已知 follow-up：plugin reload 后，serialized leaf state 存在但 surface 首次呈空态，显式 `openPdf` 后正常。此次修改未触碰 `setState/onOpen` 时序，不能据此宣称 Reader reload hydration 已通过；应单独立项诊断。
