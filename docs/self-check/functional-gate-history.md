# Reading Desk 独立功能验收

审查人：独立 functional gate 代理。当前为第二轮适配修复与数据/UI 接线阶段审查，**不是最终 DoD 通过报告**。源码仍由实现代理更新；本报告的结论绑定下列运行结果中的时间与源码 SHA256。

**当前结果（2026-09-18 15:09 UTC）**：数据层 **8 PASS / 0 FAIL**，D-07 真实文件系统回归已关闭；既有目标/坐标/签名/精确 URI **22 PASS / 0 FAIL**（依赖源码 SHA 未变，无重复重跑）；主插件装配与同步 **12 PASS / 0 FAIL**，包括改名后目标反链回写、旧 URI 依据持久化 highlightId 解析新路径、反删、源删、导出命令。完整 verify 的日志显示 **52 tests PASS**，门禁阈值未放宽。**仍不能终验通过**：P1 目标内容/摘录标题编辑/折叠、同源颜色、目录树等用户合同尚缺完整实现/原生证据；真实云端上传仍凭据阻塞；最终版本 bump 与冻结部署链未完成。

## 证据与边界

当前优先读取：`functional-data-final-result.json`（15:06:25，8/8）、`functional-host-rename-independent-result.json`（15:09:38，12/12）、`functional-repro-exact-anchor-result.json`（22/22，依赖 SHA 到本轮未变）。历史结果仅说明修复过程，不能覆盖当前状态。

- 用户任务书：`/Users/dht/.codex/attachments/19a2f4ac-1085-4115-8fe3-9aae19facea7/pasted-text.txt`。
- 控件入口：`docs/control-map.md`。本报告不覆盖视觉代理的 70 张图逐项观察结论。
- 独立复现：`node docs/self-check/functional-repro.mjs <functional-输出名.json>`。该脚本只读取实现源码，在内存运行，不修改源码或已有用户文件；输出均留本目录。
- 2026-09-18 14:11:55 UTC：`functional-repro-20260918-141155.json`，15 项中 9 PASS / 6 FAIL。
- 2026-09-18 14:13:30 UTC：`functional-repro-20260918-141430.json` 和同名 `.log`，16 项中 11 PASS / 5 FAIL。文件名不是测量时间，以内部 `timestamp` 为准。
- 2026-09-18 14:17:30 UTC：`functional-repro-synthetic-result.json` 和 `.log`，换成目标仓库内合成 `compressed-json` 样本后仍为 11 PASS / 5 FAIL。早期观察材料的个人路径已经移除，后续测试固定只用明确授权的测试资料。
- 2026-09-18 14:27:04 UTC：`functional-repro-second-fix-result.json` 和 `.log`，16 PASS / 0 FAIL。事务复现按新的 `atomicTransform` 合同测试最新文件内容，未继续调用已删除的旧 `atomicWrite` API。
- 数据集成新增复现：`functional-data-integration-repro.mjs`、`functional-data-integration-first-result.json` 和 `.log`。使用实际 JSZip 生成 EPUB、实际 pdfjs 解析有效 XMP PDF，未使用个人 vault 材料。
- 2026-09-18 14:37:56 UTC：`functional-data-integration-second-fix-result.json`，原数据 8 项为 7 PASS / 1 FAIL（AI）。`functional-repro-page-transition-result.json` 原 16 项保持全通过。
- 2026-09-18 14:39:26 UTC：`functional-repro-page-contract-result.json` 为 22 PASS；新增 6 项直接断言内部 `page=0/12` 保持不变且 Canvas、Markdown、Excalidraw 可见页码与链接为 1/13，未降低期望。`functional-data-integration-bounded-key-result.json` 7 PASS / 2 FAIL，新增缓存 basename 的实际本地写入限制复现。
- 2026-09-18 14:56:20 UTC：`functional-repro-exact-anchor-result.json` 22 PASS，页码测试升级为“正确可见页码 + 精确 source/highlight URI”，替代较弱的 page-only 链接。
- 同时 `functional-host-integration-second-result.json` 为 7 PASS：实际 main 源码配受控 Obsidian 接口，检查 enabled/disabled AI、导入/无源标记、用户 command/paste 注册、协议入口、远程裁剪不落本地 PNG。不是 mock UI；也不把受控宿主当成真实用户动作证据。
- `functional-data-only-latest-result.json` 7 PASS / 1 FAIL（D-07）。`functional-data-integration-third-result.json` 内的空 bridge AI 结果是旧孤立测试构造，已由上述生产 host 装配复现取代，不能用于当前 AI 状态判断。
- 只读接线快照：`functional-ui-source-snapshot.json`，含文件 SHA、行号与关键语句。该快照记录时间较前面的源码读取稍后，因此其中每阅读器独立 PDF factory 已出现；不能把之前的共享实例缺陷继续算成当前失败。
- 官方 COS oracle：`cos-nodejs-sdk-v5@3.0.0` 的未修改 `sdk/util.js`；见 `functional-cos-sdk-provenance.json`、`functional-cos-sdk-util.cjs` 和许可证。仅替代未被签名路径调用的 XML parser 构造器，签名使用真实 Node crypto。所有 AK/SK 都是显式合成的 `test-*` 字符串。
- 当前没有 Obsidian 用户动作证据，也没有真实 OSS/COS 账号请求；不能用这些内存测试宣称原生渲染、双向跳转或云端上传通过。

## 已独立复验的修正

| 合同 | 状态 | 证据 |
| --- | --- | --- |
| PDF 归一化坐标独立于缩放 | PASS（函数级） | 真实 pdfjs 4.10.38 载入有效 PDF，scale 2 → 1，归一化后正确还原；原实现 left 30/top 450，修正后 left 60/top 100 |
| 90° 旋转及非零 MediaBox 原点 | PASS（函数级） | `[0,0,600,800]`、`[20,30,620,830]` 两个页面 × 0°/90°，共四项实际 PDF viewport 复验 |
| 重叠 scan 旧快照不删除新发现文件 | PASS（服务级） | 阻塞旧 `[A]` 扫描，排入 `[A,B]`，最终保留 A/B |
| 单次保存失败后 scan 队列可恢复 | PASS（服务级） | 14:11 快照失败，14:13 快照在一次注入持久化错误后再次扫描成功 |
| COS ASCII、中文对象键及 bucket GET 签名 | PASS（协议级） | 分别逐字匹配官方 SDK `getAuth`；中文键为 `reading-desk/实验 图(1).png` |
| OSS V1 canonical HMAC | PASS（协议级） | 独立 Node crypto 计算与实现相同；不代表账号权限或远程上传成功 |
| Markdown 目标更新及反链数据 | PASS（适配器级） | 保留用户正文、替换同一摘录且不重复，所供精确 `sourceLink` 及 metadata 更新一致 |

## 原目标适配缺陷的修复验收

以下五项在 14:13:30 UTC 快照失败，14:27:04 UTC 已用同一独立脚本逐项复验通过。这里只确认适配器合同，原生 UI 渲染/聚焦仍待用户动作证据。

| ID | 状态 | 根因与实际结果 | 源码范围 / 复现 |
| --- | --- | --- | --- |
| F-01 | PASS（服务级） | 原缺陷：读后固定 replacement 覆盖并发用户编辑。现改为基于最新内容的 `atomicTransform` | 新增用户节点在 transaction 前到达仍保留；`main.ts` 实際注入 `vault.process(existing, current => transform(current))` |
| F-02 | PASS（字段级） | 原缺陷：没有 Canvas `color`。现写出原生颜色编号 | 独立检查两个摘录均有 color；同源视觉调色板及 UI 换色同步尚未验收 |
| F-03 | PASS（适配器级） | 原缺陷：跨 PDF 同名章节合并。现以 PDF path 与 chapterPath 一起去重 | 两 PDF × 两层章节现在生成 4 个正确归属的节点 |
| F-04 | PASS（适配器级） | 原缺陷：Excalidraw 可见 text/link 仍旧。现随 metadata 一起更新 | NEW title/text/link 实际写入 scene |
| F-05 | PASS（解析级） | 原缺陷：拒绝 compressed-json。现解码并以普通 JSON 写回，保留周边文本 | 标准 lz-string 合成 fixture 可写；普通 Excalidraw 插件实开、Text Elements 一致性和再保存仍需原生证据 |

早期 COS 实现曾采用错误的六段 canonicalRequest、原始二进制 SignKey，并缺尾换行；实现者已在本次独立复验前修正，不能继续把旧失败算到最新实现上。中文对象键也已由编码路径修正为 SDK 相同的原始 Pathname。

## 数据集成修复验收与当前阻塞

旧失败记录见 `functional-data-integration-first-result.json`；当前以 `functional-data-integration-second-fix-result.json` 和 `functional-data-integration-bounded-key-result.json` 为准。全部问题都已通知对应实现负责人。

| ID | 状态 | 证据 / 根因 |
| --- | --- | --- |
| D-01 | PASS（服务级） | 原队列失败已恢复；一次 sink.save reject 后下一次保存实际发生，保存 split 设置成功 |
| D-02 | PASS（实际 EPUB 解析） | 原 EPUB 2 cover lookup 已改正；真实 ZIP/OPF 声明的 cover item 被读取并写出 |
| D-03 | PASS（短路径碰撞） | 原中文路径碰撞已消除，甲/乙得到不同缓存 key；该实现又产生 D-07，不把原碰撞问题继续记 FAIL |
| D-04 | PASS（实际 EPUB 解析） | XML 实体已正确得到 `Science & Art`、`Alice & Bob` |
| D-05 | PASS（实际 PDF 解析） | pdfjs 从 XMP rdf:Seq 返回的 Alice/Bob 作者均保留在提取结果 |
| D-06 | PASS（生产装配） | main 已注入基于 OpenCodian 真实命令能力的 bridge；实际 main 源码在受控 host 中探测启用插件、传选区并依序调用命令，未安装时不调用、不创建上下文。真实第三方 UI 互操作仍待证据 |
| D-07 | PASS（实际文件系统） | 已改成完整源路径 SHA256。合法源 basename 137 字节 → cache basename 68 字节；独立实际文件写入成功并清理临时输出，见 functional-data-final-result.json |

## UI 与 main 接线审查

这是代码可达性与受控宿主测试，**不是用户动作验收**。以下依据 14:56 UTC 左右的当前源码，不把前一轮缺入口继续当作最新失败。

已补齐的生产调用链：

- 每 ReaderView 拥有独立 PdfRenderer；实际多 PDF 页签互不干扰仍待 UI。
- Reader 工具栏已有色盘、布局切换、缩放/按容器宽度计算适宽；高亮末尾已有评论按钮，CommentPopover 与 HighlightList 接入评论、标签、删除和换色服务。
- 换色已同时更新 AnnotationStore 和 TargetService；dragstart 已冻结归一化 rects 到专用拖拽 payload，drop 不再依赖已丢失的浏览器 Range。
- Reader open 已读取 PDF outline，摘录按当前页选择章节路径；完整 Canvas 目录树的真实生成和最具体章节归属仍待操作证据。
- 裁剪覆盖层 → PdfRenderer 真图像 → main 的本地/远程分支已接线；受控 main 测试确认远程分支只生成外链目标，不写本地 PNG。真实云端请求仍凭据阻塞。
- main 已注册 `reading-desk-highlight` URI，三目标链接携带准确 file/highlight ID，Reader 的 `openPdfAtHighlight` 入口存在；代码合同通过，实际点击回跳和原生目标节点聚焦待 UI。
- main 已注册 Markdown paste handler、AI command、导入及两种导出 command，并在设置中装配 portability panel。
- main 已用真实 OpenCodian 命令能力作 bridge：启用与插件存在性探测、创建选区上下文、调用 add-current-note-to-context/open-view；受控宿主验证调用链，普通 Obsidian 中实际 AI 获取上下文仍待运行证据。
- 导入已改读 `.obsidian/plugins/bookshelf/metadata/*.json`，并读实际旧 manifest id `obsidian-bookshelf` 下的 data.json 设置。受控 host 证明一次导入、重复不增加、不修改旧文件；无源不会设置 importedBookshelf 标记。
- 文件监听已含 create/modify/rename(oldPath)/delete；源路径与目标引用在共享存储中更新，扫描/阅读进度后刷新已打开书架。实际文件移动后的目标反链更新及即时 UI 同步仍待场景。
- 首次 metadata scan 已配置本地 pdf worker；写文件前已有目录创建。封面显示路径仍需原生验证，ShelfView 当前依然把 `book.coverPath` 直接作为 img.src。

仍需补齐/证明的用户合同：

- split 目标面板目前仍是已有目标 selector、提示文案与 dropzone，尚未提供目标原生卡片内容、摘录标题编辑及卡片折叠/展开的可操作表面；不能仅用目标文件 JSON 或 folded metadata 宣称完成。
- showTarget 当前仍是 openLinkText 后 DOM 定时查找并 scroll/focus；原生 Canvas/Excalidraw 的实际节点聚焦需真场景证明。
- Canvas 原生色号与高亮 CSS 色值分别定义；需要以共享调色板或实测一致颜色证明“同源”，换色已接通不等于颜色相同。
- 新 crop 流程已有创建按钮，但用户指定“框选后拖入画布”的时序仍需实际拖拽路径证明。
- 高亮持久化可从 AnnotationStore 重载；Reader 视图状态恢复、真实跨会话重绘与重命名后的源链接仍需运行覆盖。
- PDF 不可选文本、损坏文件、对象存储失败等状态须在真实界面可见；当前服务错误不自动算作用户可理解错误态。

## 单元测试记录

运行：`npm test -- --threads=false test/targets test/storage test/portability`。

实际输出：Vitest 0.34.6，4 个文件 / 21 个测试通过；耗时 256 ms，2026-09-18 22:12:33 本地时间。覆盖上传请求构造、粘贴服务、导入/导出、目标服务；没有浏览器环境或真实 Obsidian 原生文件渲染。该批测试全绿时上述独立复现仍失败，因此不能用总测试数替代功能验收。

22:17:30 再运行同一范围，4 文件 / 21 测试通过，退出码 0，完整输出保存在 `functional-target-storage-portability-tests.log`；对应独立失败材料是 `functional-repro-synthetic-result.json`。

22:28:16 全套运行：`npm test -- --threads=false`，**8 文件 / 33 测试通过、退出码 0**，完整输出 `functional-all-tests-second-fix.log`。未执行 build，避免与实现者正在运行的烟雾部署并发改产物；完整最终 verify 仍待稳定版本。

22:41:09 定向复验：`npm test -- --threads=false test/data test/library/MetadataExtractor.test.ts test/targets`，**3 文件 / 14 测试通过、退出码 0**，日志 `functional-data-target-focused-tests.log`。页码期望已统一为用户一基页码，该范围未再出现旧 12/13 测试冲突。独立 D-07 实际文件系统失败不在其 MemoryBinaryReader 测试覆盖范围。

22:56:40 最新全套：`npm test -- --threads=false`，**14 文件 / 51 测试通过、退出码 0**，完整日志 `functional-all-tests-integration.log`。没有通过 build/部署覆盖实现者现有烟雾环境；最终完整 verify/部署证据仍由稳定版本提供后独立核验。

## 全部 P0–P3 的集成验收矩阵

`BLOCKED（待集成证据）` 表示当前阶段尚不能作终验结论，不等同于用户必须介入；实现者继续完成并提供可运行路径。唯一已知外部凭据阻塞是对象存储账号验证。

| 范围 | 当前结论 | 下一份必要证据 |
| --- | --- | --- |
| P0 书架：指定文件夹扫描、新增/删除/重命名/移动、单一 LibraryIndex | BLOCKED（待集成证据） | 实际 vault 文件事件，保留书 ID/人工元数据/分类/进度，同步 PDF 与目标路径 |
| P0 PDF metadata/Info、EPUB OPF、标题作者页数大小封面、失败可入库 | BLOCKED（待 UI） | D-02/D-04/D-05 已通过实际解析复验；仍需实际 PDF 首页面封面与失败降级 UI |
| P0 封面缓存 | BLOCKED（待完整运行证据） | D-03/D-07 均已修复；仍需同指纹重扫不渲染、变化失效和重启复用、封面实际显示 |
| P0 两视图、分类创建/排序/指定 | BLOCKED（待 UI） | 用户操作后的共享数据与重开结果 |
| P0 PDF 渲染/可选文本/缩放/翻页/页码跳转/适宽 | BLOCKED（待 UI） | 真实 PDF 的画面与动作，不能用 DOM mock 替代 |
| P0 三条摘录入口、跨行 rects、高亮和末尾评论图标 | BLOCKED（待 UI） | 拖拽、右键、色盘各一条真实动作；保存多个行 rects；重载正确重绘 |
| P0 双向跳转及评论时间戳/单条删除 | BLOCKED（待 UI） | 双击高亮聚焦真实节点；卡片反链定位源高亮；评论跨会话持久化 |
| P1 目标类型图标、列表、换色、删除、反向删除 | BLOCKED（待 UI） | F-02 字段问题已修正，仍需 UI 换色及原生 Canvas 删除同步场景 |
| P1 标签添加/全局补全/列表 chips | BLOCKED（待 UI） | 输入已有标签触发候选、选中去重、重载及列表显示 |
| P1 全 outline Canvas 章节树与最具体章节自动归属 | BLOCKED（待接线） | F-03 已修正；仍需真实 PDF outline 到完整原生 nodes/edges 的动作路径 |
| P1 摘录专属标题、折叠展开、同源调色板、长卡片自适应 | FAIL（标题/折叠/颜色合同未闭） | 当前 split 表面只有 selector/dropzone，未提供标题编辑和折叠动作；Canvas 原生色号与 PDF CSS 色值分别定义。长卡片已有高度估算，但不抵消以上明确缺失 |
| P1 表格评分/作者/标签编辑、阅读进度 | BLOCKED（待 UI） | 编辑持久化、进入阅读/翻页更新、书架进度同步 |
| P2 真裁剪与拖放图片 | BLOCKED（待 UI） | PDF 图像区域框选 → 保存有效图片 → 原生目标显示 |
| P2 OSS/COS 和 Markdown 图片粘贴 | BLOCKED（外部凭据） | 签名已协议复验，仍需真实授权 PUT + 可读取外链；Markdown 真实粘贴事件/异步插入另待 UI |
| P2 Excalidraw | BLOCKED（待原生证据） | F-04/F-05 已修正；原生插件可打开及保留 Text Elements / 现有内容仍需实际验证 |
| P2 focus 独立窗口及默认右键落点 | BLOCKED（待 UI） | 无右面板仍能摘录，布局记忆且再次打开一致 |
| P3 AI 可选依赖 | BLOCKED（待原生证据） | D-06 生产装配已通过；仍需第三方插件实际接收选区上下文的可观察证据 |
| P3 非破坏一次性导入 | BLOCKED（待集成） | 纯映射及实际 main 目录导入/一次标记/旧源不变已通过受控 host；仍需 Test Vault 用户点击、旧目录哈希和旧封面实际显示 |
| P3 Markdown / JSON 导出 | BLOCKED（待 UI） | 当前序列化测试通过；用户可触发且生成文件可打开，导出不含存储凭据 |

## 全部 DoD 的证据要求

15:09 收口审阅新增的独立证据：

- `.obsidian-debug/full-verify-final-reader-text-layer.log` 包含 docs、owner、version、lint（`--max-warnings=0`）、14 文件 52 tests、tsc/esbuild 全链，时间为本地 23:00:07；未省略其中 owner 400 行 review-band 提醒，650/220 硬限仍保留。
- `.obsidian-debug/deploy-final-reader-smoke.sha256` 的 15:00:08 构建四文件复制时一致，console proof 确认 `[Reading Desk] Margin v0.1.0 build 0.1.0+2026-09-18T15:00:08.855Z`。15:08 独立文件重算时 workspace styles.css 已继续编辑，与该已部署 CSS 不同（见 `functional-deployed-smoke-artifacts.json`），因此这是历史阶段部署证据，不能宣称当前源码已最终冻结部署。
- 同一独立 artifact 检查读取 Test Vault 保存结果：3 个高亮分别有 11/10/15 个归一化 rects，Canvas/Markdown 目标都真实存在，Canvas highlightId 映射存在；评论有持久化时间戳；所引用 crop PNG 存在且 PNG magic 正确。这样核对了实现者烟雾报告的产物，未只复述“PASS”。
- `.obsidian-debug/reader-runtime-smoke-20260918-1500.json` 明确把拖拽摘录列为 `runtime-synthetic`，评论列为 runtime，右键菜单/裁剪列 physical。独立功能验收保留这些证据边界：不能把 synthetic drag 宣称为物理用户拖放，不能把产物存在宣称为原生节点聚焦成功。
- `functional-dod-document-snapshot.json` 检查 418 控件行 / 70 来源图、映射路径存在情况、四 ADR、版本同步。最终 control-comparison 由视觉代理负责；本轮检查时仍须等其正式报告及状态更新，不能以 reference 观察报告代替当前插件对比。

尚缺的最小闭环证据（限定用户合同，不新增产品要求）：

1. 可操作 split 目标内容、仅摘录标题编辑/折叠展开、色盘两侧一致；带真实 outline PDF 到章节 Canvas nodes/edges、摘录归属。
2. 原生双击高亮聚焦 Canvas 节点、卡片链接回 Reader 精确高亮；原生 Canvas 删卡后 PDF 重绘消失。main 受控 host 的存储 reconcile、rename 回写与旧 URI 解析已 PASS，但不能替代原生动作。
3. 扫描新增/删除/移动后的书架与阅读表面变化、重启高亮重绘、两视图/分类/表格编辑/进度及封面显示。需 Test Vault 场景，当前纯服务通过仍不算所有动作完成。
4. Excalidraw 的普通插件实际打开、链接和删除；P3 AI 真实第三方接收上下文；真实导入/导出入口实际产生可打开文件。当前 main/adapter 测试已证明代码可达，尚不证明跨插件 UI。
5. 真实已授权 OSS/COS PUT+读取与 Markdown 粘贴外链，缺凭据保留 BLOCKED；不拿官方 SDK 签名 oracle 或 mock fetch 代替。
6. 最终更改后的完整 verify、版本 bump、build、按顺序复制、四件哈希、当前启动行，以及视觉 control-comparison 与更新后的 control-map。旧0.1.0阶段证据不能代替收尾链。

1. `npm run verify` 完整日志与退出码：已阅读完整 52-test verify 日志；仍需待当前修正完成后最终稳定版本完整 verify，不能把旧部署日志替代新源码门禁。
2. control-map 每行落点：交由视觉代理完成逐行核对，功能终验将交叉验证真实文件/类及行为可达性。
3. 四 ADR 已存在；终验须核正文与实际实现一致，特别 worker 回退和真实封面流程。
4. 所有 P0–P3 运行实现与有意义 vitest：以上矩阵仍有 FAIL 和缺动作证据。
5. 70 图对比报告：视觉代理负责；本报告不冒充逐图视觉验收。
6. bump → build → Test Vault 部署 → 哈希 → 控制台首行：已取得 0.1.0 的 15:00:08 verify/build/deploy/startup 证据，但最终版本 bump 与冻结版本链尚未完成。
7. 全部自主决策：检查 `docs/decisions/auto-log.md` 与实际替代行为对齐，不能用自研决策删掉明确功能。
8. 最终只给证据：本报告保存失败而非包装为完成。

门禁初审：继承脚本仍保留 650 行 owner 硬限制、400 行 review-band、220 行函数 lint 限制以及 `--max-warnings=0`；完整 `verify` 仍串行执行 docs → owner → version → lint → test → build。终验将再次确认这些规则没有放宽。
