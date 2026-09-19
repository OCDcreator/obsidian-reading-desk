# Reading Desk 独立功能验收

最终原生补验：**2026-09-19 00:39–00:41 上海时间**（UTC 2026-09-18 16:39–16:41）。候选 **Margin v0.1.1 / build `0.1.1+2026-09-18T16:32:50.656Z`**。产物复核时间见 `functional-final-release-artifacts.json`。

**结论：已测本地核心功能通过；已确认并登记的功能缺陷剩余 0，不作全部 DoD 无限制通过声明。** 本轮确定的数据、目标与原生缺陷已修复并按对应层级复验；最新补验关闭完整目录预生成和裁剪可信拖放两项证据缺口。真实 OSS/COS 账号请求仍 **BLOCKED（缺凭据）**。Excalidraw 自身链接点击手势未证明成功；真实场景、精确定位、正确链接与系统 URI 路由通过。AI 通过生产桥接合同测试，未运行模型会话。视觉总门禁以独立视觉最终确认文档为准。

当前结论优先于 `functional-gate-history.md` 的历史快照。原生操作层级、时间与截图详见 `functional-native-acceptance.md`；不得仅凭证据文件名中的 pass 判断通过，必须读取实际值。

## 工程和发布

| 检查 | 结论与证据 |
| --- | --- |
| 完整 verify | PASS（独立日志审阅）：`.obsidian-debug/final-verify-0.1.1-crop-host.log` 含 docs→owner→version→lint→tests→tsc/esbuild，**17 文件 / 69 tests PASS** |
| 硬门禁 | PASS：owner 650行、400 review-band、函数220行、`--max-warnings=0` 保持，未放宽 |
| 版本与部署 | PASS：package/package-lock/manifest均0.1.1；独立重算 main/manifest/styles/worker 四件 build/Test Vault SHA 全相同，见 `functional-final-release-artifacts.json` |
| 启动身份 | PASS：`.obsidian-debug/final-release-startup-proof-0.1.1-crop-host.log` 含当前 build；未以旧候选 errors 日志冒充本候选新错误采集 |
| 文档和映射 | 四ADR、PRODUCT、DESIGN、AGENTS、auto-log、phase0–5、control-comparison存在；control-map418行/70图且映射src均存在。存在性不等于视觉或所有动作通过 |
| 架构约束 | 单一manifest、desktop-only、vanilla DOM/Obsidian API；LibraryIndex/AnnotationStore共享ReadingDeskRepository。未改旧Bookshelf/OpenCodian/全局skills |

功能代理未与实现者并发build/deploy。完整verify取实现者实际全量日志独立审阅；四件产物SHA由本代理重新计算，早期局部测试不替代最终门禁。

## P0–P3 矩阵

PASS后括号限定实际证据层级。源码、组件/服务测试、受控宿主测试、实际插件运行、Input真实指针分别记录，不能互相冒充。

| 范围 | 当前结论 | 实现、测试与运行证据 |
| --- | --- | --- |
| P0 扫描增删改移、唯一真源 | PASS（服务+实际Vault） | `LibraryIndex.ts/main.ts`；LibraryIndex测试；重叠scan/失败队列独立复现；合成PDF真实入库、CLI move保留id/进度并改反链、delete清理。`functional-final-active-reader-rename.json`、`functional-final-source-delete.json` |
| P0 PDF/EPUB自动metadata与封面 | PASS（真实解析/写盘+本地重扫） | `MetadataExtractor.ts`；真实JSZip EPUB2/3、pdfjs XMP、XML实体、SHA256 cover key实际写盘；`functional-data-final-result.json` **8/8**；`.obsidian-debug/metadata-rescan-cover-final.json`三份实际PDF首页封面资源 |
| P0 缓存、失败降级、手动编辑 | PASS（实现/测试），UI有限覆盖 | LibraryIndex同指纹缓存/cover失败重试测试；提取失败可入库、Shelf编辑入口。未声称所有坏文件/缺字段组合均有真实动作证据 |
| P0 两视图、分类排序/指定 | PASS（实现+测试+表面观察） | `ShelfView.ts/ShelfViewModel.ts`、view-model测试、视觉明暗卡片/表格；本代理未逐个真实点每个单元格/分类操作 |
| P0 PDF渲染、文本选择、导航/缩放/适宽 | PASS（原生主路径） | `PdfRenderer.ts/ReaderView.ts`；真实1页及合成3页PDF，Input选择文本、下一页至page2、工具栏存在。大文档性能及所有尺寸不在此声明内 |
| P0 拖拽/右键/色盘摘录 | PASS（真实运行/可信Input） | 跨2行Input选中，再held/move/release，浏览器记录dragstart/drop **isTrusted=true**，写Canvas/highlight；`functional-native-drag-final-result.json`。右键/色盘早期smoke有实际目标产物独立核对 |
| P0 rects持久化/scale/rotation | PASS（实际pdfjs viewport+重载后重开） | 四个跨scale/90°/非零viewBox复验；`functional-reload-outline-reopened.json`重载后page2/4rects正确重绘。未声称整个workspace自动恢复全部leaf状态 |
| P0 Canvas双向跳转 | PASS（原生Input） | 真实点定位目标→Canvas.selection精确id/视口可见，实际点原文链接→Reader正确PDF/page/highlight；`functional-native-canvas-focus-pass.json`、`functional-native-backlink-result.json` |
| P0 评论、时间戳、删除 | PASS（组件/持久化+运行评论） | `CommentPopover/AnnotationStore`及测试；TestVault评论createdAt/showTimestamp真实，`functional-deployed-smoke-artifacts.json`；单条删除由组件测试覆盖 |
| P1 列表类型图标/标签补全/换色/删除 | PASS（实现/组件测试+表面） | `HighlightList/CommentPopover`，标签去重/候选/颜色/删除接线，recolor同步TargetService。未把所有补全键盘状态都算原生实测 |
| P1 原生删卡反删 | PASS（原生回归） | 原生Delete后等待Canvas保存，store=false、Reader marks0/cards0，章节保留；`functional-final-reverse-delete.json` |
| P1 outline与归属 | PASS（完整目录运行补验+已有归属证据） | 新空Canvas经Reader实际select/change生成全部4章节、1条Methods→Details层级边、0摘录，包含未摘录分支；再次选择序列化内容完全一致。`functional-complete-outline-setup.json`、`functional-complete-outline-select.json`。选择动作是DOM原生select change，非物理点选，未直接调用sync服务；第二页摘录最具体归属仍由`functional-outline-nodes.json`证明 |
| P1 摘录标题/折叠/展开 | PASS（原生Input回归） | 标题真实输入保存Canvas text/metadata；fold原生screen+disk72px，unfold240px，text/source保留，普通节点不改；`functional-native-title-saved.json`、`functional-final-fold-72.json`、`functional-final-unfold-native.json`及PNG |
| P1 同源调色板 | PASS（单一语义来源），视觉最终确认另计 | `shared/ReadingDeskPalette.ts`提供同一Canvas色号及CSS变量，renderer/adapter共同消费；不沿用早期颜色分离FAIL |
| P1 表格编辑与进度 | PASS（实现/测试+实际阅读进度） | Shelf字段接线；真实3页第2页进度2/3，rename保留；全套表格真实输入动作覆盖有限 |
| P2 裁剪本地图片 | PASS（真实pointer预览+可信手柄拖放） | pointer框选生成342×148、20679-byte PNG Blob，pointer-up后无新PNG且既有Canvas仍4章；随后held/move/release手柄拖入已选Canvas面板，dragstart/drop均isTrusted=true，4→5节点且4章保留，新增原生file节点/PNG magic/归一化rect与源page一致、token清空。`functional-crop-prepared-no-write.json`、`functional-crop-trusted-drop-result.json`；不以直接commit或synthetic DragEvent替代 |
| P2 OSS/COS与图床 | 协议/接线PASS；**真实请求BLOCKED** | COS官方SDK3.0.0独立oracle（ASCII/中文key/GET）、OSS独立HMAC；main远程分支不留PNG、paste listener与外链接线。无账户凭据，未真实PUT/GET/Markdown粘贴上传；mock不抵消BLOCKED |
| P2 Excalidraw场景/映射/focus | PASS（原生最小场景） | 官方2.27.3原生解析新标准scene；stable highlightId匹配官方重写live id并选中/缩放；`functional-excal-011-fresh-scene.json`、`functional-excal-final-focus-pass.json` |
| P2 Excalidraw source link | 字段与系统URI PASS；宿主点击手势未证 | 正确file/highlight URI经系统open→Obsidian Received URL action→activeReader/page1/mark1；`functional-native-url-action-result.json`。header/tooltip Input点击未证明跳转，不声称物理点击PASS |
| P2 focus独立布局 | PASS（实际切换+接线） | 已从持久focus切split，控件可达；独立右键默认坐标摘录实现。所有屏幕尺寸由视觉有限桌面范围确认 |
| P3 AI可选依赖 | PASS（生产桥接合同），真实模型未测 | main按enabled/getPlugin/实际OpenCodian命令能力探测；真实main受控host创建来源上下文、执行命令，未安装不调用；`functional-host-integration-second-result.json`，不虚构模型回复 |
| P3 非破坏一次导入 | PASS（真实旧结构/宿主合同） | main读旧metadata目录，重复无新增、无源不消耗标记、旧文件不变；`functional-host-rename-independent-result.json`及portability测试。用合成旧结构，不实际改用户旧库 |
| P3 MD/JSON导出 | PASS（command handler+输出内容） | 实际main命令创建可解析MD/JSON，无存储凭据；`functional-host-rename-independent-result.json`。原生命令面板点击未另冒称 |

## 已修缺陷

数据D01–D07、早期目标F01–F05均对应修正并独立复验。原生N01折叠仅摘要、N02反删不重绘、N03Reader旧路径，**已在15:54:23部署后真实回归PASS**，并非只看source已改。Excalidraw正式envelope及官方重写id造成focus失效，也已按实际插件修正。最终16:32:50候选的完整目录与裁剪可信拖放补验均PASS；本代理已确认并登记的缺陷均已闭合，未覆盖或未证明的行为仍保留为下述限制。

## 剩余限制与DoD边界

1. **OSS/COS真实授权上传和图床最终端到端BLOCKED：缺凭据。** 签名oracle不能代表远程账户权限/网络成功。
2. **Excalidraw自身链接点击手势未证。** 场景/映射/focus/.link与系统URI路由已证，不扩张为点击手势全通过。
3. **AI真实模型会话未运行。** 接入能力、未安装禁用、命令和上下文传递合同通过，不等于模型完成对话。
4. **视觉门禁等待独立视觉最终确认。** 418行control-map不因文件存在机械改成已完成。
5. 全部表格/标签/错误态操作、全workspace自动恢复等仍属有限覆盖；因此不能宣称任务书每一DoD均已PASS。完整outline预生成和裁剪可信拖入既有Canvas已补验，不再列为未证明项。

## 环境与审查职责

Test Vault Canvas核心原先禁用，经授权启用并保留；官方Excalidraw2.27.3原先不存在，经授权仅在TestVault安装/启用。未修改主vault。合成PDF仅目标repo与TestVault fixture目录，删除/改名仅本任务样本。功能代理只写本目录functional-*报告/脚本/输出和测试fixture，不改实现/旧插件/全局skills。

最终产物：`functional-final-release-artifacts.json`。原生详细证据：`functional-native-acceptance.md`。历史快照：`functional-gate-history.md`。
