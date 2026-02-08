---
name: gen-changelog
description: Generate changelog entries for the `## Unreleased` section in `CHANGELOG.md` from the current branch diff against `main`.
---

# Generate Changelog

根据当前分支相对于 main 分支的修改，在 CHANGELOG.md 文件的 `## Unreleased` 部分添加更新日志条目。

## 格式规范

- 条目格式：`- <Scope>: <描述>`
- Scope 分类：`Core`, `UI`, `Tauri`, `Config`, `Build`, `Docs`
- 只记录对用户有意义的变更

## 步骤

1. 运行 `git diff main...HEAD` 查看当前分支的修改
2. 分析修改内容，提取有意义的变更
3. 按照格式规范生成条目
4. 将条目添加到 CHANGELOG.md 的 `## Unreleased` 部分
