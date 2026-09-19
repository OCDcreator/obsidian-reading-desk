# ADR 0001：新仓库与构建边界

## 决定

Reading Desk 使用独立仓库与插件 id。仅从只读 `../obsidian-bookshelf` 继承 package scripts、TypeScript/esbuild/ESLint/Vitest 配置、版本与文档/owner guards，以及 `.opencode/skills/impeccable/` 的基础设施。源码、模块边界、视觉、数据模型、存储位置和“元数据手填优先”决策一律不继承。

## 原因

这是一个书架与 PDF 阅读器的单一插件，不是旧插件的增量改名。独立构建和数据前缀避免覆盖既有安装或旧数据，同时保留已验证的质量门禁。

## 后果

所有运行时代码从 `src/` 重新开始；旧仓库的 HEAD 与关键文件 SHA-256 基线记录在阶段 checkpoint，后续再次复核。
