# Reading Desk 真实视觉验收

## 0.1.1 有界确认（2026-09-19 本地）

**当前 disposition：ship（本轮视觉缺陷清单已关闭；功能外部限制见功能报告）。** 最终候选 `0.1.1+2026-09-18T17:18:51.094Z` 仅重验 V-03/V-06，其他 resolved 项沿用此前证据，未做全新 full audit。独立实际测量和两张已逐张查看的截图见 `visual-v03-v06-final.json`、`visual-v03-v06-final-light.png`、`visual-v03-v06-final-dark.png`；四个部署 SHA 前后一致。

| ID | 确认结论 | 最新实际证据 |
|---|---|---|
| V-01 | resolved | 继续阅读卡196×472.73，maxWidth196；旧571×951巨卡消除。首屏可见书名与进度；仍为产品卡片，不把较高卡片另开审美缺陷。`visual-confirm-light-shelf-card.png` |
| V-02 | resolved | 最新书架实测图片均 `complete=true`、naturalWidth 209–210 / naturalHeight 280–295，封面截图可读；URL由 vault resource path 提供。`visual-final-light-shelf.png`、`visual-final-light-table.png`、`measurements.json` |
| V-03 | resolved | 同一1600×953视口、Reader884px，明暗两态body/toolbar client=scroll=884，PDF514=514、目标panel266=266。适宽后无原横向溢出，截图原文完整。`visual-v03-v06-final.json` |
| V-04 | resolved（布局） | drawer client=scroll=358，行client=scroll=294，摘要/操作不叠字，删除动作可见；颜色识别问题归V-06，不重复计。`visual-confirm-dark-reader-750-drawer.png` |
| V-05 | resolved | 最新单一 portal host 挂 BODY、opaque surface、360×586，窄 split 右界 866 < viewport 1600，未见跨 pane 叠层；关闭按钮与五色入口可读。`visual-final-dark-narrow-comment-single.png` |
| V-06 | resolved | 同一个评论popover节点由light切dark（sameNode=true），五色最低对比light4.594:1、dark5.595:1，全部>=4.5。靛青前景随主题从近白改近黑，4.623→6.716；五色可区分且文字不叠。`visual-v03-v06-final-light.png` / `-dark.png` |
| V-07 | resolved（已测范围） | split 真实摘录卡、标题、折叠/定位、全 outline nodes/edges、trusted crop drag、反删同步、源 rename/delete、Excalidraw focus/URI 均有最终 functional evidence；Excal 原生元素具体点击手势仍未证明，作为边界记录。`functional-native-acceptance.md`、`functional-crop-trusted-drop-result.json` |
| V-08 | resolved | Settings h2 实测 20px/650，h3 15px/600，比例 1.33；light/dark 900×700 root 675px 无横溢，正文样本 <=75ch。`visual-final-settings.json`、`visual-final-settings-dark.json` |
| V-09 | resolved | 最新 comment button bounds 24×24（client 22×22，outline/命中尺寸 24），达到桌面目标；`visual-final-light-comment-wide.png`、最新 DOM measurement |
| V-10 | resolved | 最新真实 compositionstart/input 与 compositionend/input 均 `sameNode=true`、`focused=true`；空筛选文案仍可见。`visual-final-shelf-ime.png`、`visual-final-light-table-cleared.png` |

本次 final build identity：`0.1.1+2026-09-18T16:32:50.656Z`；`main.js=52fe9488…0175c`、`manifest.json=236da1b…a374`、`styles.css=a291459…ab63`、`pdf.worker.mjs=7c237f8…6323`，每项均与 Test Vault 部署一致。该段为上一候选身份记录。最后两项已在17:18:51构建关闭；终止时恢复moonstone/light、左右宿主栏原折叠状态与右栏650宽；没有使用或修改Emulation，hot-reload仍关闭。

本轮中途初始宿主还有功能验收留下的第二个工作区，产生676px/364px附加窄窗记录；这些不是假1440宽面板。之后临时保存并收起该测试pane，按首轮同1440×1000 viewport、主Reader1374及右栏展开约750px进行直接对比。结束恢复light、左右栏collapsed、清Emulation，并恢复原生Excal和源Reader测试pane。没有build、reload或源码样式写入。

最终 V-03/V-06 定点测量均 PASS，V-01–V-10 无剩余视觉阻断项。此结论仅覆盖已列缺陷与已测桌面主题/容器，不扩张为移动端、所有第三方主题、云账号或所有宿主链接手势通过。

## 首轮保留证据

**Disposition：fix。首轮完成，尚不具备 ship 条件。** 本轮为一次集中审查；修复方已获 UI 释放通知。下一轮只确认本批缺陷、新增 P1 目标面板及原生目标结果，不再展开无限抛光。

## 构建、范围与证据

- 被测构建：`0.1.0+2026-09-18T15:00:08.855Z`；部署 main/styles/manifest SHA-256 与首轮结束时一致，见 `visual-runtime-identity.json`。仓库源码随后有施工变动，不能拿当前源码冒充本轮运行版本。
- 真正打开的 Obsidian Test Vault，桌面 `1440×1000` CSS px、DPR 1（CLI 截图实际 2880×2000）；窄面板通过宿主右栏展开得到约 `750.25px`，不是 mobile。Settings 是独立真实窗口 `900×700`，DPR 2，明确 target id 与 main 不同。
- 设置窗口的插件 `.reading-desk-settings` profile probe 为 `selected`，root可见、assertions通过；见 `visual-settings-probe.json`。按任务边界未进行宿主安装包/全局迁移验收。
- `measurements.json` 含 21 次表面/DOM记录和截图路径。`light-reader-drawer` 是错误激活的新标签页，明确排除；`light-reader-split` 保留此前 scrollTop=189.5、显示页尾空白，明确不拿它判断加载失败。其余截屏在具名表面可见后获取。PDF稳定时 canvas=1、text spans=96、`.rd-error`为空。
- 已检查 light/dark Shelf 卡片与表格、Reader focus/split、抽屉、评论、窄桌面分栏、筛选空态、设置禁用状态及键盘焦点。没有伪造损坏 PDF 错误态或云端凭据错误；error/loading/无文本PDF禁用链仍缺最终真实场景证据。
- 插件 hot-reload 未启用，目录无 `.hotreload`。本轮未改源码/styles；退出时恢复 light、左右宿主栏原状态并清除设备尺寸覆盖。
- CLI/CDP DOM操作触发真实插件控件；键盘焦点用 `Input.dispatchKeyEvent(Tab)`。拖拽摘录的先前 smoke 仅为 synthetic DragEvent，不能宣称本轮物理拖拽验证；真实 pointer裁剪/右键证据由独立 runtime smoke 保存。

## 有影响的发现（一次修复批）

| ID / 严重度 | 实际证据与影响 | 修复落点 / 确认标准 |
|---|---|---|
| V-01 / P1 | 继续阅读卡 `571.02×950.88px`，内容可视高 `903.67px`。浅色窄栏书名 y=1067.23，低于pane底991；进入书架首先看到大块“无可用封面”，分类/主书库/表格被推到折下。表格在滚动后可见，不能说完全不可达。见 `visual-light-shelf-card.png`、`visual-light-shelf-narrow.png` | ShelfView/CSS；继续阅读应是紧凑入口，封面尺寸有上限，首屏可辨书名和继续操作，表格切换直接呈现表格 |
| V-02 / P1 | 真正可读 `reader-text-fixture.pdf` 有 pageCount=1、无metadataError却没有coverPath；化学PDF保存了 `No "GlobalWorkerOptions.workerSrc" specified.`。卡片多处实际显示无封面/页数未提供。见 `visual-library-metadata.json` 与深色卡片截图 | MetadataExtractor/组合根；配置worker、真实首页面封面缓存、失败可重试，不能仅缩小占位图掩盖 |
| V-03 / P1 | 750.25px Reader pane 的 toolbar client750/scroll900；PDF固定765px且 x=-72.73，左正文被裁；目标panel client223/scroll237，选择器越界。viewport仍1440，max-width媒体查询未适配容器。见 `visual-dark-reader-narrow-split.png` | Reader/CSS；container-aware工具条重排、正确按PDF列适宽、目标控件min-width:0；无不可见翻页操作或正文左裁 |
| V-04 / P1 | 高亮drawer宽360px，client358/scroll474；行宽294却scroll419，摘要/五色按钮/删除挤在一行，右侧动作被裁。见 `visual-dark-reader-drawer.png`、`visual-light-reader-drawer-valid.png` | HighlightList/CSS；摘要可换行、操作分组下移、合理图标/标签，无横向内容丢失 |
| V-05 / P1 | 评论swatch实际28×28，client26/scroll59，按钮可见长文案相互覆盖；每条评论删除按钮重复整条正文造成密度。评论host宽360、窄pane右端823.93 > pane805.25，挂在PDF内部导致裁切。抽屉同时打开遮挡评论右半。见 `visual-light-reader-comment.png`、`visual-dark-reader-narrow-comment.png` | CommentPopover/CSS/Reader；色点+短可见名称/aria-label；浮层挂ownerDocument的脱离滚动容器层，末端anchor+边界避让、明确关闭和焦点返回；避免overlay互遮 |
| V-06 / P1 | 深色toolbar五个色盘按钮文字对比 `1.89:1`（非disabled）；浅色选中分类/视图按钮约`3.46:1`，低于普通文字4.5。当前宿主覆盖背景后五色外观几乎相同，标签色义不可辨。见dark-reader和light-shelf测量 | palette/CSS；普通文字>=4.5:1、焦点/边界>=3:1，用文字与选中记号同时表达，不只靠颜色 |
| V-07 / P1 | 目标panel仅“加载已有目标…”选择器与拖放说明，没有实际目标卡片内容；摘录标题/折叠用户入口、真实outline→完整章节演示尚未完成，impl已确认。不是把adapter参数当UI完成 | Reader目标组件/TargetService；下一轮实际文本/图片卡片、标题、折叠和原生Canvas nodes/edges/回链独立验证 |
| V-08 / P2 | 原生设置h2/h3均15px/600，层级比1.0；Shelf22/18=1.222、18/16=1.125；目标标题16/正文14=1.143，均低于brief的显式1.25（不能只用22/16跨级比掩盖）。见measurements | tokens/局部标题；相邻信息层级明确，满足用户1.25阈值并保持密集工具区合理 |
| V-09 / P1 | 评论入口仅18×18；低于桌面WCAG2.2目标24px，且与高亮密接；toolbar大部分30px高、swatch28px符合桌面24px最低但不宣称44px触屏要求通过 | PdfRenderer/CSS；扩大实际命中区至少24px且不遮正文，保留可见focus |
| V-10 / P2 | 无搜索结果仍显示继续阅读巨卡；真实input处理后activeElement回body，输入节点被整树重建。筛选空态在页底，难以发现。见 `visual-dark-shelf-empty.png` | ShelfView；保留输入节点/焦点/IME，筛选结果和空态处于合理上下文，确认连续键入 |

## 实测质量维度

| 维度 | 评分 | 证据与限制 |
|---|---:|---|
| Accessibility | 1/4 | 有真实Tab焦点，但色盘1.89、选中3.46对比失败，18px评论入口，部分动作裁切 |
| Performance | 未评分 | 未做性能录制；PDF稳定渲染存在，不由截图推断帧率或大文档性能 |
| Responsive（桌面容器） | 1/4 | 1440完整pane基础可用，750px pane发生工具条/正文/浮层裁切 |
| Theming | 2/4 | 真实light/dark生效；语义色受宿主主题覆盖，明暗对比存在失败 |
| Implementation Integrity | 1/4 | 主流程有真实数据，尚有缺表面及布局矛盾；不以detector空列表判定通过 |

因性能未测，不计算虚假的总分。机械layout detector返回`[]`，但目标为修复中的当前source（见`visual-layout-detector.json`），与本轮部署有差异，不能推翻真实截图缺陷。

## 正向证据与尺寸记录

- `.rd-reader-toolbar` padding `12px 16px`、gap `8px`、常规高度55；`.rd-reader-body` padding24、split gap16；target panel padding16、gap12；Shelf padding24、网格gap16、卡片padding10/gap10。这些实际computed值已有统一节奏，但首屏比例与窄pane结构仍失败。
- 评论摘要测量约37.1ch、目标说明28.6ch、设置描述48.1ch，均<=75ch；表格是数据布局，不套用正文行宽。设置h2/h3所在可用宽约67.9ch；未发现设置横向溢出。
- 真实键盘Tab使“放大”获得 `:focus-visible=true`，outline2px、offset2px，见 `visual-light-reader-keyboard-focus.png`；其文本对比7.77。此证据仅覆盖该控件，不能推断所有控件键盘流程通过。
- 设置未启用对象存储时图床toggle与测试连接不可用且有原因；实际独立窗可浏览Endpoint/Region/Bucket/前缀/AK/SK、AI与导入导出入口，无凭据提交或网络请求。
- 评论真实已有持久内容与时间戳，PDF canvas、文本层及跨行高亮可見；不将本视觉证据扩张为双向跳转、反向删除与对象存储上传PASS。

## 证据索引与确认轮

关键文件：`measurements.json`、`visual-runtime-identity.json`、`visual-library-metadata.json`、`visual-settings-probe.json`、`visual-*.png`。每个measurements capture都有唯一id、时间、截图路径、实际bounds/computed样式/contrast/controls/overflow；同一截图的桌面宿主外观属于用户现用主题，不要求插件替换宿主chrome。

确认轮只验证 V-01–V-10、新增P1可达表面以及原生目标真实结果；剩余error/loading/无文本禁用状态必须明确补证或记限制。布局、主题和焦点确认仍为desktop-only，不制造移动或Apple Pencil验收。

## 独立截图复核附录

两名fresh只读审查者分别逐图查看 Shelf 4图与 overlay/settings 3图并读取同名测量，没有操作UI或修改实现。均确认 V-01/V-03/V-04/V-05；补充：深色三张书库卡均207.66×489.39px，仅用约49.4%的网格宽，封面占位比正文更突出；图书长/短标题仍被拉为同高卡，降低研究资料浏览密度。此项并入V-01同批改，不新增抛光轮次。

他们同时确认：表格滚动后实际可见、设置没有严重横向溢出（client=scroll=675）、评论底部裁切约12.27px但容器可滚动，不能声称“不可访问”。四张书架图不是长篇正文，容器measureCh>75不等于正文行宽违反。所有这些边界已纳入本报告。
