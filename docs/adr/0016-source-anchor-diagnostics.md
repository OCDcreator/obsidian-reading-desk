# ADR 0016：源文件变更与锚点核验

- 状态：Accepted
- 日期：2026-10-02

## 决策

新创建的标注可记录创建当时的源文件 stat（`sourceFingerprint: { mtime, size }`）。宿主负责读取文件信息，阅读器在创建标注时传入，AnnotationStore 仍是标注唯一真源。重命名或重关联不将已有标注的指纹静默刷新为新文件的指纹。

SourceAnchorDiagnostics 是纯只读服务，输入同一源文件的当前标注列表与当前 stat，输出 matched / changed / unknown。mtime 或 size 不同说明文件信息变化；两者相同仅说明 stat 未变，绝不是文件哈希、正文相同或锚点仍正确的证明。旧标注没有指纹、源文件暂缺、stat 无效均为 unknown。诊断不修改页码、归一化 rects[]、指纹或目标文件，也不持久化第二套标注数据。

SourceAnchorDiagnosticsPanel 挂在现有高亮抽屉，默认折叠，提供变化与未知数量、物理页码及已有印刷页标签、原引文片段、章节和“查找引文”。显示的引文最多 240 字符、章节最多 120 字符；点击检索使用原引文开头最多 120 字符，保留 AnnotationStore 的完整原文。空文本不生成猜测引文，禁用检索并提示按页码人工核验。面板每页最多 20 项，全部诊断保持可达。仅通过回调进入现有全文搜索，不自动重新锚定。

## 验证边界

纯服务测试覆盖 matched / changed / legacy-unknown / missing-current，以及不改写输入；DOM 测试覆盖折叠、印刷页与物理页、引文检索、空文本禁用、分页和错误反馈。真实 PDF 被替换后的视觉锚点是否正确仍需人工核验；stat 变化提示不能替代正文比对。
