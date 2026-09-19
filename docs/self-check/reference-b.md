# 参考图逐张观察 B：19–35（含 23b）

观察者：reference_b。2026-09-18。仅记录参考图，不声明运行原插件，也不把截图文件名当作行为证据。逐张使用 `view_image` 查看，未使用 contact sheet。责任模块均为我方规划类名，待主任务把实际文件路径并入 `docs/control-map.md`；本文不代表已实现。

参考根目录：`/Volumes/SDD2T/obsidian-vault-write/技术学习/zattachments/pdf-flow/`。图中品牌、主题、图标样式、视频水印与字幕不作为我方视觉资产；字幕若提供行为信息，明确标成“字幕”。

## 精确文件清单（18 张）

1. `19-comment-no-timestamp.png`
2. `20-context-menu.png`
3. `21-crop-mode.png`
4. `22-drag-cropped-image.png`
5. `23-object-storage-settings.png`
6. `23b-settings-entry.png`
7. `24-image-host-external-link.png`
8. `25-split-screen-drag.png`
9. `26-tag-add-window.png`
10. `27-tag-autocomplete.png`
11. `28-highlight-list-tags.png`
12. `29-comment-window-color.png`
13. `30-crop-mode.png`
14. `31-custom-category.png`
15. `32-card-tag-icon.png`
16. `33-category-saved.png`
17. `34-category-reorder.png`
18. `35-table-view.png`

## 19 — 19-comment-no-timestamp.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 19-comment-no-timestamp.png | PDF 工具栏；左上；页码 `177 / 275`、搜索、缩放等图标；常态 | 直接观察：PDF 与右侧目标画布并排；页码输入及总页数可见。推论：允许页码导航与缩放，具体快捷键未观察到。 | ReaderView、PdfRenderer | 计划中 |
| 19-comment-no-timestamp.png | 多行高亮及末尾小评论图标；PDF 正文；黄色与紫色；常态 | 直接观察：不同段落保留不同底色，部分选段末尾有小图标。推论：每段可独立操作；本图未展示点击过程。 | ReaderView、AnnotationStore、PdfRenderer | 计划中 |
| 19-comment-no-timestamp.png | 摘录节点；右侧中央；青色标题 `Note20250718005311`、正文与 `认知觉醒, p.177` 链接；红色外框选中 | 直接观察：节点含标题、原文和来源链接；右上有斜向展开样式图标。推论：来源链接可回到 PDF，展开图标的具体行为未观察到。 | TargetService、ReaderView、AnnotationStore | 计划中 |
| 19-comment-no-timestamp.png | 评论行；节点正文下方；铅笔样式图标、`评论：`、`添加评论`、`1121212`、`+`；常态 | 直接观察：有现存评论文本与新增入口，没有显示日期时间；字幕明说节点卡片中添加的评论不会自动添加时间戳。推论：`+` 为新增评论入口。 | TargetService、AnnotationStore、ReaderView | 自研替代（用户要求所有新增评论自动记录并显示时间戳，保留节点评论入口但统一数据真源） |
| 19-comment-no-timestamp.png | 选中节点浮动工具条；节点上方；垃圾桶、调色板、聚焦样式、编辑样式图标；可见 | 直接观察：四个图标在选中节点附近显示。推论：删除／改色／定位／编辑的图标语义；具体触发后结果未观察到。 | TargetService、AnnotationStore | 计划中 |
| 19-comment-no-timestamp.png | Canvas 视口工具条；最右侧；设置、加减、适应视图、撤销／重做等；常态 | 直接观察：纵向工具条存在。推论：这些是目标画布的视口操作；不证明由参考插件实现。 | TargetService（宿主 Canvas 委托） | 自研替代（复用 Obsidian 原生 Canvas 视口能力，插件只维护摘录映射与跳转） |

## 20 — 20-context-menu.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 20-context-menu.png | 原文选区；PDF 中部三行；灰绿色底色；已选中 | 直接观察：一段文字跨三行被覆盖，下面另有黄色已存在高亮。推论：操作菜单与当前多行选区关联。 | PdfRenderer、ReaderView | 计划中 |
| 20-context-menu.png | 选区上下文菜单；选区右下；三行菜单；展开 | 直接观察：菜单覆盖正文；字幕为“鼠标右键呼出选项菜单”。推论：右键选区提供摘录目标，不要求先拖拽。 | ReaderView、TargetService | 计划中 |
| 20-context-menu.png | 菜单项；第一行；`添加到Canvas文档` 与网格图标；未显示禁用文案 | 直接观察：该目标独立占一行；落点坐标、二级选择器与点击结果未观察到。推论：向 Canvas 写入当前选区。 | TargetService、AnnotationStore | 计划中 |
| 20-context-menu.png | 菜单项；第二行；`添加到Excalidraw文档（暂不支持）` 与笔形图标 | 直接观察：明确显示“暂不支持”；是否真的禁用无法仅凭画面确认。 | TargetService | 自研替代（按用户 P2 要求实现 Excalidraw；缺少依赖时显示明确禁用原因，不沿用永久不支持） |
| 20-context-menu.png | 菜单项；第三行；`添加到Markdown文档` 与文档图标 | 直接观察：第三种目标可见；未见目标文件选择器或写入结果。推论：可导出文字到 Markdown。 | TargetService、AnnotationStore | 计划中 |
| 20-context-menu.png | 已有高亮评论入口；下方黄色正文末尾；小气泡样式图标 | 直接观察：黄色高亮覆盖多行，末尾存在圆形小图标。推论：高亮数据与临时选区并存。 | ReaderView、AnnotationStore、PdfRenderer | 计划中 |

## 21 — 21-crop-mode.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 21-crop-mode.png | 双栏阅读布局；左 PDF、右画布；两侧都显示文档名；常态 | 直接观察：PDF 正文有插图，右侧 Canvas 远景有多个节点。推论：裁剪可与现有画布同时使用；截图本身未见已完成裁剪结果。 | ReaderView、TargetService | 计划中 |
| 21-crop-mode.png | PDF 工具栏；左上；`178 / 275`、列表、搜索与缩放图标；常态 | 直接观察：页码与工具栏保留；画面中未见矩形裁剪框。 | PdfRenderer、ReaderView | 计划中 |
| 21-crop-mode.png | 裁剪入口；PDF 页面右缘中部；蓝色方形内剪刀样式图标；可见 | 直接观察：单独的蓝色图标位于页面右边；字幕称“第三个按钮—裁剪按钮”。推论：点击进入裁剪模式；按钮悬浮显隐条件未观察到。 | ReaderView、PdfRenderer | 自研替代（把裁剪入口放入用户指定的顶部工具栏；保留同等能力，不继承悬浮外观） |
| 21-crop-mode.png | 黄色多行高亮；插图下方两段；部分段末带评论图标 | 直接观察：裁剪相关画面仍保留文本高亮。推论：裁剪模式不应丢失已存标注。 | AnnotationStore、PdfRenderer | 计划中 |
| 21-crop-mode.png | Canvas 缩放及视图按钮；最右侧纵向；常态 | 直接观察：设置、加减和适应视图样式按钮可见；缩到远景后节点正文不可辨。节点文字标为未观察到。 | TargetService（宿主委托） | 自研替代（委托原生 Canvas 导航，目标面板自身由 Reading Desk 管理） |

## 22 — 22-drag-cropped-image.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 22-drag-cropped-image.png | 裁剪模式退出入口；PDF 插图右侧；橙色 `×`；显示 | 直接观察：上一图蓝色裁剪入口所处的页面右侧现在有橙色叉号。推论：退出当前裁剪模式；本图未见按下过程。 | ReaderView、PdfRenderer | 计划中 |
| 22-drag-cropped-image.png | 拖拽反馈；Canvas 下部；鼠标旁绿色 `+` 与小矩形预览；拖拽中 | 直接观察：绿色加号伴随指针，字幕为“按住鼠标拖拽到canvas画布中”。推论：从 PDF 区域向目标 Canvas 拖入裁剪结果。 | ReaderView、PdfRenderer、TargetService | 计划中 |
| 22-drag-cropped-image.png | 新对象／临时卡片；右下；青色边框、`rect-selection-…` 文本与“裁剪模式”小标签；被选中或正在拖入 | 直接观察：文字看起来是区域选择标识，未显示完整图片。不能把本帧当作图片已成功落盘或已渲染的证据。 | PdfRenderer、TargetService、ObjectStorageService | 自研替代（自研裁剪预览、落点反馈与完成态；成功后展示实际图片，不向用户暴露临时内部标识） |
| 22-drag-cropped-image.png | 既有摘录节点；右上；标题、来源链接、`评论：`、评论文本、日期样式文本和 `+` | 直接观察：裁剪期间现有文本节点仍可见；日期样式内容为评论行的一部分，自动生成还是手填未观察到。 | TargetService、AnnotationStore | 计划中 |
| 22-drag-cropped-image.png | 对象浮动工具条；新对象上方；删除、调色、聚焦和编辑图标 | 直接观察：对象工具条可见。推论：裁剪对象进入画布后复用画布对象操作；该图不能证明删除能反向清理 PDF 标注。 | TargetService、AnnotationStore | 计划中 |

## 23 — 23-object-storage-settings.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 23-object-storage-settings.png | 设置对话框；居中大面板；顶部产品设置标题，右上 `×`；已打开 | 直接观察：后方阅读与画布模糊，设置层覆盖；关闭入口明确。 | ReaderView、ObjectStorageService（设置入口及配置接口） | 自研替代（使用 Reading Desk 原生设置页或 Modal，不复制原产品名称与绿色标题） |
| 23-object-storage-settings.png | 开关；上部；`启用对象存储`；开启 | 直接观察：开关滑块在右，说明文字提及默认本地仓库、开启后上传对象存储、网络流量与存储费用。推论：关闭时本地保存，开启时走远程存储。 | ObjectStorageService | 计划中 |
| 23-object-storage-settings.png | 开关；第二行；`启用Markdown粘贴自动上传`；关闭 | 直接观察：滑块在左；说明说在 Markdown 粘贴图片会自动上传并在光标处插入对象存储链接；红色提示“需要先启用对象存储功能”。 | ObjectStorageService、TargetService | 计划中 |
| 23-object-storage-settings.png | 提供商下拉；中上右侧；`阿里云 OSS`；选中 | 直接观察：闭合下拉只证明当前 OSS 选项；其他候选项未观察到。 | ObjectStorageService | 计划中 |
| 23-object-storage-settings.png | 配置说明块；下拉下方；OSS 控制台、AccessKey 管理链接及跨域／端点说明 | 直接观察：提供外部控制台链接和 7 条说明；截图展示的公共读、宽泛跨域建议仅为来源文案。推论：用户需先在云服务准备桶与凭据。 | ObjectStorageService（设置说明） | 自研替代（重写最小权限配置说明和连接检查，避免无条件推广来源图中的公开桶／通配跨域建议） |
| 23-object-storage-settings.png | 文本框；面板下半；`服务端点`；已填 | 直接观察：输入值受框宽截断；控件与 OSS 端点说明可见。具体值不作为实现默认值。 | ObjectStorageService | 计划中 |
| 23-object-storage-settings.png | 文本框；端点下方；`区域`；已填 | 直接观察：单独 Region 输入。推论：端点与区域分别配置。 | ObjectStorageService | 计划中 |
| 23-object-storage-settings.png | 文本框；区域下方；`存储桶`；已填 | 直接观察：单独 Bucket 输入。示例桶名不转录为我方配置。 | ObjectStorageService | 计划中 |
| 23-object-storage-settings.png | 凭据输入；更下方；`Access Key ID` 与 `Access Key Secret`；均有输入区，底部被字幕遮挡 | 直接观察：AK 行可见，SK 标签及输入区部分可见；不转录画面中的凭据内容。保存／测试连接按钮与完整错误态未观察到。 | ObjectStorageService | 自研替代（提供 AK／SK 配置、默认遮掩、明确保存与测试反馈；错误文案及凭据保护方式自行设计） |

## 23b — 23b-settings-entry.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 23b-settings-entry.png | Obsidian 设置侧栏项；中间偏下；`PDF Flow`；未选中 | 直接观察：插件名出现在多个插件设置项中，位置在 Note Refactor 与 Pixel Banner 之间；本帧未进入该设置页。推论：有原生插件设置入口。 | ReaderView、ObjectStorageService（设置注册交由插件组合根） | 自研替代（注册 Reading Desk 单插件设置页，品牌与顺序不复用） |
| 23b-settings-entry.png | 其他插件列表项；设置左栏；QuickAdd 行紫色悬停／选中背景 | 直接观察：指针在 QuickAdd 附近而非 PDF Flow；因此不能据本帧声称已点击参考插件设置。 | ReaderView（边界说明） | 不做（其他插件设置属于宿主，不在 Reading Desk 范围） |
| 23b-settings-entry.png | 宿主设置正文；右侧；当前版本、自动更新、语言、获取帮助、账户等 | 直接观察：仍为 Obsidian 通用设置内容；对象存储字段在本图未观察到。 | ObjectStorageService（观察边界） | 不做（不复制宿主通用设置；对象存储实际控件见图 23） |
| 23b-settings-entry.png | 插件列表滚动条；设置侧栏右缘；细条；可见 | 直接观察：设置项可纵向滚动。推论：使用宿主 PluginSettingTab 入口即可达到可发现性，无需专用入口页。 | ReaderView（插件设置入口） | 自研替代（沿用宿主可滚动设置导航） |

## 24 — 24-image-host-external-link.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 24-image-host-external-link.png | Markdown 编辑区图片语法；页面中上；`![paste-…png](https://…aliyuncs.com/…png)`；整段显示选区底色 | 直接观察：图片为 HTTPS 对象存储外链语法，URL 包含编码后的路径；字幕说“在你的笔记中留下的，将只是一个外部链接”。推论：上传后把外链写入 Markdown，而非 vault 附件路径。 | ObjectStorageService、TargetService | 计划中 |
| 24-image-host-external-link.png | 图片预览；外链下方；一张 Obsidian 界面图片；紫色外框 | 直接观察：Markdown 链接下显示实际图片。推论：外链已能被当前编辑器渲染；截图不能证明跨设备、离线或权限过期时行为。 | ObjectStorageService、TargetService | 计划中 |
| 24-image-host-external-link.png | 图片右下斜向双箭头指针；预览边缘；悬停 | 直接观察：显示类似尺寸调整光标。推论：可能是宿主图片尺寸操作，未见拖动结果，不足以规定我方图片缩放交互。 | TargetService（宿主 Markdown 委托） | 自研替代（依赖宿主 Markdown 图片渲染与尺寸能力；上传后不额外叠加图片编辑器） |
| 24-image-host-external-link.png | 笔记标题／属性条；顶部；`未命名 1`、折叠箭头、部分标签；显示 | 直接观察：外链保存在普通 Markdown 笔记环境；上部属性被水印遮挡，完整文案未观察到。 | TargetService | 计划中 |
| 24-image-host-external-link.png | 预览图片内部的文件夹、搜索、书签与彩色文件夹条目 | 直接观察：这些控件属于被粘贴图片的像素内容，不是本帧可操作的 Reading Desk／参考插件控件。 | ObjectStorageService（内容边界） | 不做（不能把示例图片里的 UI 当作插件需求） |
| 24-image-host-external-link.png | 上方细横条；笔记属性下方；少量青色段 | 直接观察：可见细条，但没有说明文字；是否上传进度未观察到。 | ObjectStorageService | 自研替代（自行提供有文案的上传中／成功／失败反馈，不假定该细条就是上传进度） |

## 25 — 25-split-screen-drag.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 25-split-screen-drag.png | 阅读分栏；PDF 在左，点阵 Canvas 在右；浅色主题 | 直接观察：同屏存在 PDF 正文与右侧目标区域。字幕称“自动分屏后，选中原文拖拽到canvas画布”。推论：选目标或打开阅读时自动建分栏；具体触发入口未观察到。 | ReaderView、TargetService | 计划中 |
| 25-split-screen-drag.png | PDF 缩略图导航；最左；页缩略图 `193` 至 `197`；可见 | 直接观察：页码显示在缩略图角落，正文可同时显示下一页起始部分。推论：多页连续阅读及缩略图跳页。 | PdfRenderer、ReaderView | 计划中 |
| 25-split-screen-drag.png | 原文多行选区；正文中部；灰绿色底色，手形指针停在末尾；已选中 | 直接观察：待操作段落覆盖四行。字幕描述拖入画布，单帧未显示完整拖拽轨迹和完成瞬间。 | PdfRenderer、ReaderView、TargetService | 计划中 |
| 25-split-screen-drag.png | 既有高亮；选区上方；粉紫色多行高亮与末尾气泡 | 直接观察：既有高亮与新选区同时存在。推论：临时选择不替换已持久化高亮。 | AnnotationStore、PdfRenderer | 计划中 |
| 25-split-screen-drag.png | 页面侧边裁剪入口；PDF 右侧边；蓝色剪刀图标 | 直接观察：浅色主题也显示裁剪入口；尚未进入裁剪模式。 | ReaderView、PdfRenderer | 自研替代（我方将裁剪放在顶部工具栏并适配浅／深主题） |
| 25-split-screen-drag.png | 目标 Canvas 既有卡片；右下；正文、来源链接、评论行；部分超出截图 | 直接观察：节点含选摘文字、链接、评论与 `+`；细小内容及完整卡片标题未观察到。推论：目标面板已能展示先前摘录；不据此证明新选区已落卡。 | TargetService、AnnotationStore | 计划中 |

## 26 — 26-tag-add-window.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 26-tag-add-window.png | 原文高亮；放大的 PDF 正文；浅黄色跨四行；已存在 | 直接观察：高亮随行宽分段，最后一行较短；没有看到标签文字。 | AnnotationStore、PdfRenderer | 计划中 |
| 26-tag-add-window.png | 评论气泡按钮；最后一段高亮右上附近；粉红圆形内白色气泡；手形指针悬停 | 直接观察：按钮贴近末行的右端区域，指针表明可点击；本帧还未展开评论浮层。推论：入口锚定当前高亮。 | ReaderView、AnnotationStore | 计划中 |
| 26-tag-add-window.png | 标签添加窗口／输入控件；预期为浮层；本图没有可见窗口 | 直接观察：未观察到。文件名含 tag-add-window 不能作为窗口已出现或支持哪种输入的证据。 | ReaderView、AnnotationStore | 自研替代（按用户要求在评论浮层内设计标签输入与补全；可见浮层证据见图 27） |

## 27 — 27-tag-autocomplete.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 27-tag-autocomplete.png | 评论浮层；高亮末尾右侧；浅色圆角面板；已打开 | 直接观察：浮层覆盖页面空白与少部分正文，原气泡仍在左边；右上 `×` 可见。推论：与当前高亮锚定，关闭不必离开阅读。 | ReaderView、AnnotationStore | 计划中 |
| 27-tag-autocomplete.png | 色点按钮；浮层左上；黄色圆点；当前高亮为黄色 | 直接观察：色点与高亮底色对应。推论：颜色入口，具体展开色盘见其他图；本帧未展示色盘。 | ReaderView、AnnotationStore | 计划中 |
| 27-tag-autocomplete.png | 擦除／删除样式图标；色点右侧；交叉笔／橡皮形图标 | 直接观察：图标存在但无文字 tooltip；具体动作未观察到。推论：可能是删除当前高亮，不能认定是删评论。 | ReaderView、AnnotationStore | 自研替代（使用有明确可访问名称与确认语义的“删除高亮”入口；删除单条评论另设行内按钮） |
| 27-tag-autocomplete.png | 标签按钮；浮层顶行第三项；标签轮廓图标；指针在附近 | 直接观察：图标与一枚已有标签相邻。推论：用来添加或编辑高亮标签；未出现输入框。 | ReaderView、AnnotationStore | 计划中 |
| 27-tag-autocomplete.png | 标签 chip；浮层顶行；`#测试标签`；已存在 | 直接观察：标签以带边框的小胶囊展示。推论：保存标签后在当前高亮浮层可见。 | ReaderView、AnnotationStore | 计划中 |
| 27-tag-autocomplete.png | 评论空态；面板中央；`暂无评论，请在下方输入框中添加评论` | 直接观察：当前高亮没有评论且给出操作引导。 | ReaderView、AnnotationStore | 计划中 |
| 27-tag-autocomplete.png | 评论输入与提交；浮层底部；`输入新评论...` 与独立 `+` 按钮；空值 | 直接观察：文本框和提交按钮并列；键盘提交方式与禁用态未观察到。 | ReaderView、AnnotationStore | 计划中 |
| 27-tag-autocomplete.png | 标签自动补全；本帧仅字幕说明，无可见候选列表 | 直接观察：字幕为“在输入标签时，支持根据已有标签自动补全”；候选列表、过滤规则、键盘操作未观察到。推论：功能有视频说明，但交互细节需自研。 | ReaderView、AnnotationStore | 自研替代（实现基于已有标签的可键盘选择补全；候选列表样式、匹配与空结果按原生习惯设计） |

## 28 — 28-highlight-list-tags.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 28-highlight-list-tags.png | PDF 单栏阅读区；整窗；浅色主题；右侧目标面板未显示 | 直接观察：除左侧页缩略图外，PDF 占据主要内容宽度；本帧没有 Canvas 或高亮列表抽屉。推论：支持专注式阅读布局，是否独立操作系统窗口未观察到。 | ReaderView、PdfRenderer | 计划中 |
| 28-highlight-list-tags.png | 页码工具栏；顶部；`193 / 275`，列表按钮高亮；常态 | 直接观察：当前页输入、总页数、搜索、缩放和列表入口保留。列表按钮对应哪类边栏需结合已打开页缩略图；不能据文件名解释为高亮列表。 | ReaderView、PdfRenderer | 计划中 |
| 28-highlight-list-tags.png | 页缩略图栏；左侧；193–198 等页；展开 | 直接观察：纵向缩略图与滚动条可见，其中有图像页。推论：可从缩略图导航页。 | PdfRenderer、ReaderView | 计划中 |
| 28-highlight-list-tags.png | 多行黄色高亮及灰色气泡；正文下半；高亮末端附近小图标 | 直接观察：文字原始蓝色／黑色同时保留；高亮未遮挡正文，气泡可见；浮层已关闭。 | AnnotationStore、PdfRenderer、ReaderView | 计划中 |
| 28-highlight-list-tags.png | 裁剪入口；PDF 右缘；蓝色剪刀样式图标 | 直接观察：单栏布局也保留该入口。推论：裁剪不依赖右侧面板一直打开。 | ReaderView、PdfRenderer、TargetService | 计划中 |
| 28-highlight-list-tags.png | 高亮列表与其中标签；本帧未显示 | 直接观察：未观察到列表、标签 chips 或列表跳转按钮；不能因文件名声称它们可见。 | ReaderView、AnnotationStore | 自研替代（按用户明确要求实现抽屉列表和标签行；具体可见证据需由其他参考图补足） |
| 28-highlight-list-tags.png | 宿主状态栏；右下；反向链接计数、主题及其他插件状态 | 直接观察：状态栏并非阅读器正文的一部分；各项归属不能从截图完整判定。 | ReaderView（宿主边界） | 不做（不复制 Obsidian 或其他插件的状态栏功能） |

## 29 — 29-comment-window-color.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 29-comment-window-color.png | 评论浮层；高亮末尾右下；浅色面板、右上 `×`；展开 | 直接观察：浮层带顶行工具、评论区域、输入区；在正文附近打开。 | ReaderView、AnnotationStore | 计划中 |
| 29-comment-window-color.png | 颜色入口；浮层左上；紫色圆点；当前可见 PDF 高亮仍浅黄色 | 直接观察：按钮呈紫色而底层正文仍黄；字幕说点击颜色图标即可调整原文高亮颜色。本帧未见色盘选项及变色完成，不可声称最终色已同步。 | ReaderView、AnnotationStore、PdfRenderer | 计划中 |
| 29-comment-window-color.png | 删除样式图标；色点右侧；交叉笔／橡皮形；无 tooltip | 直接观察：图标存在，但动作后果未观察到。推论仅为删除／擦除语义。 | ReaderView、AnnotationStore | 自研替代（明确标注“删除高亮”，不只靠图形传达后果） |
| 29-comment-window-color.png | 标签入口与两个标签；顶行；标签轮廓、`#测试标签`、`#认知` | 直接观察：一个高亮可同时展示多个标签；标签在评论空态时仍存在。推论：标签属于高亮而非某一条评论。 | AnnotationStore、ReaderView | 计划中 |
| 29-comment-window-color.png | 评论空态；面板中央；“暂无评论，请在下方输入框中添加评论” | 直接观察：标签存在不代表有评论，空态独立呈现。 | ReaderView、AnnotationStore | 计划中 |
| 29-comment-window-color.png | 评论输入及新增按钮；底部；`输入新评论...`、`+`；空输入 | 直接观察：浮层提供新评论输入；具体提交快捷键、最大长度、空值反馈未观察到。 | ReaderView、AnnotationStore | 自研替代（提供明确提交语义、空值禁用与键盘可达交互；细节按自研决策记录） |

## 30 — 30-crop-mode.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 30-crop-mode.png | 双栏阅读；左 PDF、右 Canvas；浅色主题；均展开 | 直接观察：左侧保留缩略图导航，右侧显示一张较大摘录节点；两栏各有文件标题。 | ReaderView、TargetService、PdfRenderer | 计划中 |
| 30-crop-mode.png | 页码工具栏与连续页；左上 `194 / 275`；上页末尾与下页开头同屏 | 直接观察：当前工具栏页码是 194，右侧卡片来源却为 `p.193`。推论：卡片应记录真正摘录页，不可简单照抄工具栏当前页。 | PdfRenderer、AnnotationStore、TargetService | 计划中 |
| 30-crop-mode.png | 蓝紫底色文本片段及末尾气泡；PDF 上半末段；可见 | 直接观察：底色覆盖多行文字，右侧卡片正文与这段对应；是否临时选区或刚换色完成，仅凭该帧未能确定。 | PdfRenderer、AnnotationStore | 计划中 |
| 30-crop-mode.png | 裁剪入口；上下页交界右缘；蓝色剪刀样式图标；无矩形选框 | 直接观察：字幕描述“在裁切模式下，框选原文内容、拖拽原文内容也更加流畅”；实际矩形框、图片落点与完成态未观察到。 | ReaderView、PdfRenderer、TargetService | 计划中 |
| 30-crop-mode.png | 摘录节点正文；右侧中央；粉色浅底、红框、文本及右上展开图标 | 直接观察：完整摘录正文显示，未见独立标题栏；是否该节点隐藏标题无法判断。 | TargetService、AnnotationStore | 计划中 |
| 30-crop-mode.png | 标签与来源链接；节点正文下；`#测试标签`、`#认知`、链形图标和 `p.193` | 直接观察：与图 29 相同的两个标签同时出现在 Canvas 节点；页码是独立链接。推论：高亮标签应同步展示到目标节点。 | AnnotationStore、TargetService | 计划中 |
| 30-crop-mode.png | 评论入口；标签下；铅笔图标、`评论：` 与方形 `+`；空评论 | 直接观察：评论为空仍有新增入口；无时间戳条目。 | TargetService、AnnotationStore | 计划中 |
| 30-crop-mode.png | 节点边缘 `−` 与 Canvas 视口工具条；右侧；可见 | 直接观察：节点右上外缘有圆形减号，画布远右有缩放／适应等按钮。推论：减号可能控制折叠，点击后状态未观察到。 | TargetService | 自研替代（实现用户要求的摘录卡片折叠；宿主视口操作委托 Canvas，不假定该减号的内部实现） |

## 31 — 31-custom-category.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 31-custom-category.png | 书架视图切换；内容上方；`卡片视图` 蓝色选中、`表格视图` 未选中 | 直接观察：两个并排按钮，当前为封面卡片布局。 | ShelfView、LibraryIndex | 计划中 |
| 31-custom-category.png | 分类筛选 chips；视图切换下；`全部分类`、`默认分类`、`认知类`、`小说类`、`学习方法类` | 直接观察：五个不同颜色的按钮；当前画面至少展示默认分类与认知类分组。推论：chip 用于按分类筛选；选中规则与“全部”状态未完整展示。 | ShelfView、LibraryIndex | 计划中 |
| 31-custom-category.png | 分组标题与汇总；封面墙上方；`默认分类（全部7本，阅读进度15%）` | 直接观察：分类有数量与汇总阅读进度；下方 7 本排列为 4+3。推论：分类层也展示进度，但聚合公式未观察到。 | ShelfView、LibraryIndex | 自研替代（分类数量可直接计算；汇总进度公式由我方明确约定，避免把来源数值当作算法证据） |
| 31-custom-category.png | 分类顺序控件；分组标题左侧；上下小箭头；常态 | 直接观察：标题左侧可见两个竖排箭头；字幕仅说支持自定义分类。推论：排序入口，动作证据需图 34。 | ShelfView、LibraryIndex | 计划中 |
| 31-custom-category.png | 书籍卡片；中部；封面、标题、作者、页数、大小与进度百分比 | 直接观察：每张卡片下部叠加元数据，例如 PDF 页数和 MB；数据来源是自动还是手工无法由本图判断。 | ShelfView、LibraryIndex | 计划中 |
| 31-custom-category.png | 书籍分类入口；卡片左上；标签轮廓小图标；常态 | 直接观察：每本书封面左上存在小标签图标；结合图 32 字幕可知用于分类。 | ShelfView、LibraryIndex | 计划中 |
| 31-custom-category.png | 阅读进度；卡片底部；细条与 `3%`、`1%`、`0%`、`76%` 等；不同进度 | 直接观察：既有未读也有高进度书籍，进度条配数字而非只靠颜色。 | ShelfView、LibraryIndex、ReaderView | 计划中 |
| 31-custom-category.png | 下一分类分组；画面下方；`认知类（全部3本，阅读进度50%）` 与部分卡片 | 直接观察：不同分类可在同一书架中连续显示；其完整封面未观察到。 | ShelfView、LibraryIndex | 计划中 |
| 31-custom-category.png | 书籍照片横幅；顶部大图；装饰性 | 直接观察：参考书架有照片横幅；没有看到它承载输入或导航。 | ShelfView | 不做（用户明确要求独立视觉方向；不复制参考照片与装饰性横幅） |
| 31-custom-category.png | 内容右上 `</>` 样式小图标；常态 | 直接观察：可见代码样式符号但无文字说明，点击行为未观察到。 | ShelfView（未知入口边界） | 不做（控件用途未观察到，且未出现在用户 P0–P3 功能要求中） |

## 32 — 32-card-tag-icon.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 32-card-tag-icon.png | 分类设置 Modal；书架中央；`设置PDF分类`；展开且背景模糊 | 直接观察：对话框覆盖卡片书架；字幕说点击卡片左上角标签图标即可分类。推论：操作针对单本书，而非修改全局分类名称。 | ShelfView、LibraryIndex | 计划中 |
| 32-card-tag-icon.png | 分类输入框；标题下方左侧；`请输入分类名称（留空为…`；焦点框 | 直接观察：输入提示受控件宽度裁切，后半句未观察到；当前空值。推论：允许输入新的自定义分类；留空语义不能从截断提示确定。 | ShelfView、LibraryIndex | 自研替代（明确完整提示“留空使用默认分类”，保持可键盘编辑，不复制截断提示） |
| 32-card-tag-icon.png | 现有分类选择区；输入下方；`现有分类：` 与四枚边框 chips | 直接观察：候选为默认分类、认知类、学习方法类、小说类；没有“全部分类”，说明它是筛选项而非实际书籍分类。 | ShelfView、LibraryIndex | 计划中 |
| 32-card-tag-icon.png | 保存按钮；弹窗右下；`保存`；可见 | 直接观察：修改需显式保存；是否空值可保存或保存后立即更新书架，本帧未见结果。 | ShelfView、LibraryIndex | 计划中 |
| 32-card-tag-icon.png | 取消与关闭；保存右侧 `取消`、右上 `×`；可见 | 直接观察：两种退出入口。推论：取消不应用修改，具体行为需我方验证。 | ShelfView | 计划中 |
| 32-card-tag-icon.png | 当前书架背景；后方卡片与分类 chips；不可清晰交互 | 直接观察：原卡片位置仍在背景，且未进入阅读器。推论：分类编辑保持在书架上下文内。 | ShelfView | 计划中 |

## 33 — 33-category-saved.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 33-category-saved.png | 视图切换；顶部；`卡片视图` 选中、`表格视图` 未选中 | 直接观察：分类编辑后仍留在卡片视图；未跳入阅读器。 | ShelfView | 计划中 |
| 33-category-saved.png | 分类 chips；切换按钮下；新增 `学术研究类`，另有全部／默认／认知／小说／学习方法 | 直接观察：相较图 31 多了新分类；字幕为“保存后，即可将选中的电子书分类到该类别下”。推论：保存时可创建分类并重归属该书。 | ShelfView、LibraryIndex | 计划中 |
| 33-category-saved.png | 新分类标题；第一分组；`学术研究类（全部1本，阅读进度2%）` | 直接观察：新分组只有一本书并显示进度；和下方默认分类同时展示，不是仅单一筛选结果。 | ShelfView、LibraryIndex | 计划中 |
| 33-category-saved.png | 已分类书籍；新分组唯一卡片；`PPT_01_Machine learning Basics`、作者、51 页、1.36 MB、2%；青色边框 | 直接观察：该卡片在图 31 属默认分类，现移到学术研究类；卡片元数据仍保留。青色边框是 hover 还是键盘焦点未观察到。 | ShelfView、LibraryIndex | 计划中 |
| 33-category-saved.png | 默认分类汇总；第二分组；`全部6本，阅读进度17%` | 直接观察：相较图 31 的 7 本减少 1 本，进度数值相应改变。推论：分类变更会更新分组数量与汇总。 | LibraryIndex、ShelfView | 计划中 |
| 33-category-saved.png | 分类上下移动图标；两处分组标题左；上／下箭头；可见 | 直接观察：新分组与默认分组均有一对上下箭头，第一分组也显示上箭头形状；边界禁用样式不清晰。 | ShelfView、LibraryIndex | 自研替代（实现持久化排序，并为首／末分组提供明确禁用态及可访问名称） |
| 33-category-saved.png | 卡片标签入口；卡片左上；标签轮廓；可见 | 直接观察：重分类后入口仍存在。推论：分类可再次修改。 | ShelfView、LibraryIndex | 计划中 |

## 34 — 34-category-reorder.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 34-category-reorder.png | 分组排序控件；`默认分类` 标题左侧；上下箭头，指针在下箭头附近 | 直接观察：手形指针指向此区域；字幕明说“点击分类左侧的上下图标，即可调整分类显示的上下位置”。推论：是分类排序，而非只折叠组内容。 | ShelfView、LibraryIndex | 计划中 |
| 34-category-reorder.png | 分组标题；当前最上可见组；`默认分类（全部5本，阅读进度21%）` | 直接观察：默认分类当前显示在最上可见区域，数目与图 33 不同；不能据单帧认定排序动作改变了数量。 | ShelfView、LibraryIndex | 计划中 |
| 34-category-reorder.png | 分类 chips；页面顶部；学术研究仍排在默认之前 | 直接观察：chips 顺序与当前首个可见分组不相同。推论：分组排序可能独立于 chips 排序；本帧不足以确定同步规则。 | ShelfView、LibraryIndex | 自研替代（我方使用单一持久化分类顺序，让导航与分组一致；这一规则须写入自主决策记录） |
| 34-category-reorder.png | 书籍封面卡片；中部；5 本以 4+1 展示；元数据与百分比保留 | 直接观察：分类重排界面继续展示封面、作者、页数、大小和进度。 | ShelfView、LibraryIndex | 计划中 |
| 34-category-reorder.png | 视图切换；顶部；`卡片视图` 选中，`表格视图` 可用 | 直接观察：排序入口出现在卡片模式；截图未展示表格模式下是否也能操作排序。 | ShelfView、LibraryIndex | 自研替代（两个书架表面共享分类顺序与同一排序能力） |
| 34-category-reorder.png | 卡片分类图标；封面左上；红色标签轮廓 | 直接观察：各卡片仍保留独立分类入口；无需打开书籍。 | ShelfView、LibraryIndex | 计划中 |

## 35 — 35-table-view.png

| 截图文件 | 控件（类型／位置／文案／状态） | 直接观察事实／可推论行为 | 我方计划责任模块／类名 | 状态 |
| --- | --- | --- | --- | --- |
| 35-table-view.png | 视图切换；顶部；`表格视图` 青色选中、`卡片视图` 未选中 | 直接观察：卡片被分组表格取代，分类导航保持同一组。 | ShelfView、LibraryIndex | 计划中 |
| 35-table-view.png | 分类导航与分组标题；顶部和各表格上方；六枚 chips、`学术研究类（全部2本，阅读进度3%）`、默认分类 | 直接观察：分类仍作为表格的分组边界，有数量、进度与上下箭头。推论：两种视图共享分类数据。 | ShelfView、LibraryIndex | 计划中 |
| 35-table-view.png | 表头；第一表格；图标 + `书名`、`作者`、`评价`、`进度`、`页数`、`大小`、`标签` | 直接观察：七列有明确文本标题，数据按书逐行展示。未见封面列、分类列或列排序箭头。 | ShelfView、LibraryIndex | 计划中 |
| 35-table-view.png | 书名链接；每行第一列；青色可换行标题 | 直接观察：长书名断行为两行；推论：点击可打开对应书籍，实际打开动作不在本帧。 | ShelfView、ReaderView | 计划中 |
| 35-table-view.png | 作者单元格；第二列；作者文本 | 直接观察：行中显示 `RobertMurphy`、`LaTeXwithBeamer` 等；未进入作者编辑状态，不能由本图确定编辑方式。 | ShelfView、LibraryIndex | 计划中 |
| 35-table-view.png | 评价单元格；第三列；十个星形位置分两行，每行五个；第二行书显示六个实心星 | 直接观察：第一书为上行五颗实心、下行五颗空心；第二书上行五颗实心、下行首颗实心。推论：参考支持超过五星的等级，不应误读为普通五星制。 | ShelfView、LibraryIndex | 计划中 |
| 35-table-view.png | 星级选择弹层；评价列下方；`选择评价星级：` 与 `(1星)` 至 `(9星)` 可见，`(6星)` 高亮 | 直接观察：点击评价单元格后的菜单可见；字幕说明可点击单元格对选中书星级评价。菜单更低处被字幕及画面下缘遮挡，完整末项文字未观察到。 | ShelfView、LibraryIndex | 自研替代（采用与十个星位一致的 0–10 评分，并明确清空入口；键盘交互与末项布局自行设计） |
| 35-table-view.png | 阅读进度、页数、大小单元格；中间三列；`3%`、`33页`、`2.29 MB` 等 | 直接观察：表格进度为文本百分比，页数与大小分别独立列；本图未见单元格中的进度条。 | ShelfView、LibraryIndex、ReaderView | 计划中 |
| 35-table-view.png | 标签单元格空态；前两本书右列；斜体 `未设定` | 直接观察：无标签时使用明确占位文本；不留空白。 | ShelfView、LibraryIndex | 计划中 |
| 35-table-view.png | 标签单元格；默认分类书籍右列；多枚不同颜色 chips，如人生意义／心灵寓言／生活转向 | 直接观察：同本书可有多个标签且换行；本帧未展示编辑弹层。推论：标签与分类是独立字段。 | ShelfView、LibraryIndex | 计划中 |
| 35-table-view.png | 表格行状态；第一表第二行；整行底色较亮，指针在评价单元格 | 直接观察：当前操作行有底色区别；这是 hover、选中还是菜单关联状态不能仅由本帧区分。 | ShelfView | 自研替代（明确 hover、focus 与正在编辑三个状态，不以颜色作为唯一标识） |

## 覆盖与边界结论

- 实际查看：18 / 18，完整覆盖 19–35，包含 23b；分批落盘节点为第 5、10、15、18 张。
- 本组清楚可见：选区右键目标菜单、评论浮层与空态、标签 chips、对象存储设置、Markdown 图片外链、PDF 与 Canvas 分栏、封面书架分类、分类修改与排序、表格及星级选择。
- 必须保留的“未观察到”：26 图的标签输入窗口、27 图的补全候选列表、28 图的高亮列表、30 图的实际裁剪框、35 图评分菜单被遮挡的最末项。
- 关键差异：19 图 Canvas 评论没有自动时间戳（字幕确认）；20 图 Excalidraw 标“暂不支持”；按用户任务，我方统一评论时间戳并实现 Excalidraw 可选目标。35 图明确呈现十个星位，不能误实现为仅五星上限。
- 自研细节：稳定错误文案、禁用理由、键盘交互、焦点环、空值与失败反馈、分类排序在两种视图中的一致性。仅有静态参考图，不能声称已验证原插件运行行为或性能。
