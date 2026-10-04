# 书架 A/B/C 改版验收证据(shelf-abc-rework)

- 分支:`zcode/shelf-abc-rework`(worktree `~/zcode-worktrees/obsidian-reading-desk/shelf-abc-rework`)
- 日期:2026-09-20 ~ 2026-09-21
- 依据:ADR 0007(决策 1–24)、`docs/prototypes/reading-desk-bookshelf-prototype.md` 样式契约
- 宿主:Obsidian 1.13.7,testvault

## 1. 构建与门禁

- `npm run verify` 全绿:styles:sync / check:project-docs / check:owner-guard(650 行硬门禁)/ version:check 0.2.0 / lint 0 warning / vitest **48 文件 181 测试全部通过** / tsc+esbuild。
- 行数:main.ts **648 行(wc -l,owner-guard 口径 649/650,未加行)**;ShelfView.ts 443(编排层);shelf/ 模块 26–165 行/文件。
- 新增/修改测试:`test/views/shelf/ShelfSorting.test.ts`(排序)、`ShelfViewModel.test.ts` 扩(组合筛选/统计/重点卡/页码换算/状态存取/坏值兜底)、`ShelfStyles.test.ts`(CSS 契约)、`test/library/LibraryIndex.test.ts` 扩(renameCategory/removeCategory)。

## 2. 部署(AGENTS.md 顺序)

- 四件套按 main.js → manifest.json → styles.css → pdf.worker.mjs 顺序复制到 `/Volumes/SDD2T/obsidian-vault-write/testvault/.obsidian/plugins/obsidian-reading-desk/`,每轮 SHA-256 逐一核对一致(共 3 轮部署对应 3 次修复迭代)。
- `plugin:reload` 后 console 出现新的 Reading Desk 作用域启动标识:`[Reading Desk] Margin v0.2.0 build 0.2.0+2026-09-20T15:46:49.744Z`(首轮)及后续修复轮 `…T16:08:26.302Z`、`…T16:5x`;全程 `dev:errors` 无 Reading Desk 作用域错误。

## 3. impeccable detect(项目本地技能)

- 命令:`impeccable detect --json src/views/ShelfView.ts src/views/ShelfItemView.ts src/views/shelf/ assets/styles.css`
- 首轮:0 findings、4 advisory(封面角标 `rgb(255 255 255 / 34%)`/`#fff`、台账路径 11px、modal 遮罩 `rgb(0 0 0 / 32%)`)→ 按规范以 DESIGN.md frontmatter 登记消解(colors: `cover-badge-bg/border/ink`、`modal-scrim`;typography: `path 11px`;另有 `badge: var(--font-ui-smaller)`)。
- 复测:`total: 0`。

## 4. 视觉验收截图(17 帧)

目录 `docs/self-check/shelf-rework-screens/`,CDP 元素级截帧(`obsidian_cdp_capture_ui.mjs --target-title-contains "Reading Desk 书架"`,未用 dev:screenshot;暗色用 `document.body.classList`,截前 eval 断言新 DOM 并 detach 陈旧 leaf):

| 场景 | 浅色 | 暗色 |
|---|---|---|
| A 全景(书卡墙+继续轨+chips) | a-full-light | a-full-dark |
| 页头(书架 h1/副文案/扫描/导入/更多) | a-header-light | a-header-dark |
| 工具栏(搜索+三态切换) | a-toolbar-light | — |
| 继续阅读轨 | a-continue-light | — |
| chips 行 | a-chips-light | — |
| 超长双语书名卡 | a-longtitle-light | — |
| 作者编辑态 | a-author-edit-light | — |
| 无结果空态 | a-empty-light | — |
| 管理分类 modal | a-manage-modal-light | a-manage-modal-dark |
| C 台账(摘要+表) | c-ledger-light | c-ledger-dark |
| C 摘要 4 格特写 | c-summary-light | — |
| B 导航(侧栏+重点卡+网格) | b-nav-light | b-nav-dark |

布局测量 JSON 证据与契约逐项对照见 `measurements.md`(全部通过:1368 容器/24 工作区/25-20-16-14-12/封面 0.7/进度 3px/两行 clamp 2.6em/全卡等高/224 sticky/172 重点卡/42 小封面等)。

## 5. 独立评审(两轮+终验)

- 独立设计评审子代理(未见 detect 输出,读代码+逐张读图):
  - 第一轮:暂不通过——P0×1(就地编辑事件冒泡误开书)+ P1×5 + P2×12。
  - 第二轮:P0 与 4/5 P1、几乎全部 P2 修复确认;唯一未决 P1-2(台账长书名居中截断)。
  - 终验:**通过**——P1-2 修复确认(真因:宿主 button flex/center chrome 两端裁切且 ellipsis 失效;`display: block` 恢复左起截断+尾省略号,c-ledger 双主题像素证据确认「原子结构与化学键核心…」形态);其余各项全部修复确认;两条不阻塞样式残留(重复 frame 规则、760 块 width:100%)已顺手清理。
- 独立视觉目测子代理(中性描述提示词,无预期结论):14 帧事实描述,独立佐证了台账书名截断、B 窄卡裁切(修复前)与修复后的正常形态。

## 6. 行为人肉模拟(obsidian eval/CDP 逐步驱动,每步 console 无 Reading Desk 新报错)

| 步骤 | 结果 |
|---|---|
| 点书卡开书 | reader leaf 打开正确 pdfPath ✓ |
| 翻页滚动 | progress 0.9333→(重开 0.0333)→滚动后 0.5,lastReadAt 更新;回书架继续轨首位变该书,B 重点卡显示「上次读到第 15 页」(ceil(0.5×30)) ✓ |
| 作者就地编辑(占位态) | 点击→输入框(placeholder 作者姓名)→blur/Enter 保存,仓库与 DOM 一致 ✓ |
| 分类三路 | chips「+」新建(文学)✓;右键改名(学术→人文)/上移/删除(含两步确认)✓;管理 modal 新建/改名/重排/两步删除/关闭 ✓;chips 与 B 导航列实时同步 ✓ |
| 台账就地编辑 | 评分 7、标签「模拟,标签」(去重)持久化 ✓;摘要 4 格与真实数据逐项吻合(5 本/3 正在读/4 摘录/39%) ✓ |
| 筛选组合 | 搜索×分类命中与互斥、阅读记录筛选态(4 本、锁定最近阅读排序、aria-pressed、退出恢复)、排序切换+localStorage ✓,组合不串 ✓ |
| 键盘 | Tab 聚焦卡片、Enter 开书、Space 激活 chip、:focus-visible 2px accent 环(规则在活样式表) ✓ |
| 插件 reload | 布局=导航、排序=书名、分类/作者/评分/标签全部保持 ✓ |

## 7. 过程中发现并修复的真实缺陷

1. **就地编辑事件冒泡误开书(P0)**:卡片/台账行的 click/keydown 未过滤编辑器目标,输入框内点击或 Enter(含 IME)会触发打开图书。修复:`isEditorTarget` + `isComposing` 双守卫 + `bindInlineInput` keydown stopPropagation + 行级 `event.target !== row`。
2. **管理分类 modal 旧快照(P1)**:modal host 持打开时的 books/categories 数组引用,ShelfView.reload 换新数组后列表与仓库失同步(新建分类不显示、删除行残留)。修复:host 改为 `getBooks()/getCategories()` 取值函数。
3. **断点用窗口媒体查询在 leaf 内失效(P1)**:改 `.rd-shelf { container-type: inline-size }` + `@container`(1180/880),工作区 padding 移到 frame 使窄容器可缩。
4. **台账长书名居中截断(P1)**:宿主 button flex/center chrome 两端裁切且 ellipsis 失效;`display: block` 恢复左起截断+尾省略号。
5. 其余:B 重点卡按钮全宽(justify-self 在 flex 失效→align-self)、作者焦点环、台账小封面浅色隐形(1px line)、modal 焦点陷阱+归还焦点+直角、chip ContextMenu 键、B 空态复用、书名 h3→p(Heading-Root Rule)等。

## 8. 已知接受项(不阻塞)

- 锚定操作菜单(showActionMenu)打开后不移焦,菜单项不可键盘遍历;键盘等价路径走「管理分类」modal(有焦点陷阱)。
- 封面纸面阴影在满宽封面下于卡内信息区上沿形成轻微灰晕(契约允许的功能性阴影,与原型一致)。
- 台账在窄 leaf 需横向滚动,未固定首列(数据密集表按原型接受)。
- 深色下封面角标 82% 深底与深纸面接近,主要靠白 34% 描边识别(契约色值)。
- 书架点卡从第 1 页打开(既有行为,openPdf 默认页 1,与阅读器域相关,非本轮裁决范围;进度会即时重写)。

## 9. 结论

- ADR 0007 决策 1–24 全部落地;三阶段验收(部署/视觉/行为)完成;证据齐全。
- ADR 0007 状态改 Accepted;分支已提交推送,**未合并 main,等待用户确认**。
