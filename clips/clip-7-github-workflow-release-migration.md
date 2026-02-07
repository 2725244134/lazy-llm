---
Author: cctop
Created: 2026-02-08
Updated: 2026-02-08
Status: Implemented
Commits: ci(release): migrate llm-council GitHub maintenance workflows and prepare v0.1.1
---

# CLIP-7: Migrate GitHub Workflow and Release Maintenance Logic from llm-council

## Problem statement

`lazy-llm` 缺少与 `llm-council` 对齐的 GitHub 维护基线：

1. 没有标准 CI workflow（PR/push 自动执行检查与测试）。
2. 没有 release tag 与版本号一致性校验。
3. release 操作步骤没有在仓库内形成统一、可执行规范。

这会导致发布口径不一致，且 tag 发布时无法自动阻止版本错误。

## Non-goals

1. 不在本 CLIP 内引入自动 changelog 生成。
2. 不在本 CLIP 内引入自动创建 GitHub Release 资产上传流程。
3. 不变更应用功能逻辑（仅工程维护与发布治理）。

## Design

### Data structures / contracts

1. 新增 tag/version 校验脚本：`scripts/check_version_tag.ts`
   - 输入：`--expected-version`（支持 `vX.Y.Z` 或 `X.Y.Z`）
   - 校验：`package.json#version` 必须与 tag 对齐
2. 新增 Makefile 入口：`release-verify-tag`
   - 作为唯一 release 版本校验命令入口

### Boundaries and dependencies

1. GitHub CI workflow (`.github/workflows/ci.yml`)
   - 触发：`pull_request` / `push(main)`，路径过滤
   - 执行：`make check`、`make test-unit`、`make test-electron-smoke-headless`
2. GitHub tag validation workflow (`.github/workflows/validate-tag.yml`)
   - 触发：tag push (`v*` / `[0-9]*`)
   - 执行：`make release-verify-tag EXPECTED_VERSION=${GITHUB_REF_NAME}`

### Trade-offs

1. 版本对齐先只校验 `package.json`
   - 原因：Electron 项目当前版本单一来源即 `package.json`
   - 代价：若未来新增第二版本源，需要扩展脚本
2. CI 中 Electron smoke 使用 xvfb
   - 原因：保证 Linux runner 可稳定执行桌面烟测
   - 代价：增加少量系统依赖安装时间

## Test plan

1. 本地运行：
   - `make check`
   - `make test`
2. 本地验证 tag/version 脚本：
   - `make release-verify-tag EXPECTED_VERSION=v0.1.1`
3. release 演练：
   - bump 版本、提交、打 tag（本地）

## Implementation notes

1. workflow 命令入口保持 Makefile-first，避免在 CI 里散落原始 `bun run` 细节。
2. 将 release 操作步骤同步到 `AGENTS.md`，保证团队协作时流程一致。
