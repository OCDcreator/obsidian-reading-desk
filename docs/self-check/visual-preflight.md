# 视觉验收前的表面可达性审查

本记录是施工阶段的源码与只读运行预检，不是最终视觉验收；没有使用一次批量截图或确认轮次。源码正在变动，结论只绑定 `visual-preflight.json` 中的 SHA-256 与时间。实现代理拥有源码修复，本代理只记录证据。

## 实际只读运行状态

`obsidian help` 包含 Developer 命令。`obsidian vault=testvault eval` 返回：插件实例存在，`enabledPlugins.has('obsidian-reading-desk')` 为 false；Reader leaves=3，Shelf leaves=5；视口 1600×953；可见书架文本包含 `path.split is not a function` 和“重试”。启用集合与运行实例状态不一致，且本轮正值重载修复期间，不能作为最终安装失败结论，也不能宣称表面稳定。

未改窗口布局、主题、全局设置或用户数据。没有将尚未加载的 PDF 截图当作完成态。

## 一次性可达性缺口清单

| ID / 严重度 | 当前证据 | 必须补齐的可运行表面 | 参考图 / 需求 |
|---|---|---|---|
| V-PRE-01 / P0 | `ReaderView.render()` 仅创建工具栏、单页 body 与 drawer；没有 split/focus 切换或目标文档路径选择；`createTarget()` 每次创建新文件 | 目标类型与具体文档选择；focus/split 预设及记忆；可见的目标面板与真正目标文件区分 | 06、07、20、41、54；§5.3 |
| V-PRE-02 / P0 | 当前仅 `contextmenu` 调用 `createExcerpt()`；没有 `dragstart/drop` 或选区色盘提交 | 真实多行选区拖放到目标、色盘式摘录、明确落点反馈；三入口共享同一标注真源 | 08–10、25、46；§5.4 |
| V-PRE-03 / P0 | `PdfRenderer.renderHighlights()` 只有着色 div；Reader 无评论浮层或评论提交/删除处理 | 每条高亮末尾具名评论按钮、锚定浮层、空态/输入/时间戳列表/单条删除，PDF 与目标侧入口共享数据 | 16–19、27、51、58；P0 评论 |
| V-PRE-04 / P1 | drawer 有摘要、色点、Unicode 目标标记、标签文字和跳转，但没有颜色操作、删除、标签编辑或补全 | 真实图标系统；具名换色/删除、高亮标签输入与已有标签候选；列表展示并跳转实际目标 | 15、26–30、59–61；P1 |
| V-PRE-05 / P0 | `enterCropMode()` 只发 Notice；未创建框选层/截图/拖放出口 | 可取消的 PDF 区域框选、实际图片生成与落盘、拖到目标后显示；本地/远程错误反馈 | 21、22、30、62；P2 |
| V-PRE-06 / P1 | `fitWidth()` 固定 scale=1.25；toolbar 不换行，PDF host 使用固定实际像素宽度 | 按可用 pane 宽度适宽，窄桌面 toolbar 重排和可达操作；以渲染后测量验证 overflow | 05、40、52；P0 适宽，§5.5 |
| V-PRE-07 / P1 | renderer 有 `getOutline()`，Reader 无调用或章节入口；当前创建 highlight 的 chapterPath 固定为空 | PDF outline→真实 Canvas 章节 nodes/edges、自动归属；摘录标题编辑、折叠/展开、原生节点同色可见 | 44–50、65、68；P1 |
| V-PRE-08 / P1 | 无可见返回源链接处理的组合根注册；当前 `showTarget` DOM 查询且只 delayed focus | 验证双击→原生目标节点聚焦、目标来源链接→源 PDF 精确高亮；不能以目标摘要面板代替 | 43、48、56、57；P0 双向跳转 |
| V-PRE-09 / P1 | Shelf 表格只有标题、作者、标签、评分、进度五列；header 使用 td；search 每个 input 事件重建整棵 UI | 补图中页数/大小列、语义 th；保持搜索输入焦点与中文组合；核验分类组汇总及两个表面的排序/计数 | 31–39；P0/P1 |
| V-PRE-10 / P1 | 主入口目前只注册打开书架/扫描两条命令；未见 MarkdownImagePasteService、BookshelfPortabilityService 消费；AI 只有设置文字 | 真实 Markdown 粘贴事件、非破坏导入/导出用户入口、AI 条件启用/禁用入口；服务存在不等于可达 | 24、69；P2/P3 |
| V-PRE-11 / P1 | 设置页无插件专属 root；对象存储关闭时图床仍可切换；仅 SK 为 password | 真实设置窗口可辨认 root；未配置存储的禁用原因、字段/诊断/测试结果；凭据默认遮掩及长帮助文本换行 | 23、23b、63；§5.5 |
| V-PRE-12 / P1 | Reader await open 前缺加载表面及失败捕获；主源码未注册 delete；空态为纯文本，无加载骨架 | PDF loading/error/无文本层禁用状态；扫描删除事件可见更新；最终统一检查 hover/focus/disabled/loading/error/empty | §4 P0、§5.5 |

## 控件映射“不做”复核

原 26 条中 3 条 Excalidraw 工具/画笔委托已改为“自研替代”：委托宿主不免除 P2 集成与真实打开验证。剩余 23 条仅为视频水印/字幕、操作系统与宿主通用导航/工具、其他扩展属性、参考装饰照片、未来分享计划和没有需求依据的 PDF 本体墨迹。P3 Markdown/JSON 导出、AI 可选集成和 Excalidraw 目标仍保留；未以截图模糊删除任何 P0–P3 必做项。

## 最终验收启动条件

实现方给稳定构建、部署标识、实际 fixture 与窗口交接；Shelf 能加载，PDF canvas/textLayer 完整且无错误；上述表面都存在可触发入口。随后只进行一次明暗/1440/窄桌面面板批量测量和截图，批量提交缺陷，最多一次修复确认。当前 disposition 为 **fix（表面尚未齐备）**，不是视觉评分结果。
