---
Author: Codex
Created: 2026-02-11
Updated: 2026-02-11
Status: Implemented
Commits: refactor(views): extract pane load monitor from view manager
---

# CLIP-1: ViewManager 加载恢复职责拆分

## Problem statement

`electron/views/manager.ts` 在白屏修复后继续膨胀，已经同时承担：

- 视图生命周期编排
- Pane 加载失败重试与恢复状态管理
- 错误页回退渲染

这种结构导致变更风险扩大：任何 Pane 恢复策略调整都会触碰主编排类，测试也只能通过较重的集成路径覆盖，难以保证重构稳定性。

## Non-goals

- 不调整 IPC 契约
- 不改变 Pane 恢复策略语义（重试次数、回退时机、错误页行为）
- 不重写 Quick Prompt 或 Prompt 注入逻辑

## Design

### Data structures

- 新增 `PaneLoadMonitorOptions`：注入恢复策略参数与最小查询回调（pane 目标 URL、provider 元信息）。
- 新增 `RecoverableWebContents`：描述监控器所需的最小 WebContents 能力集合。
- 新增 `PaneLoadMonitor`：
  - 维护 `webContentsId -> PaneRecoveryState`
  - 负责绑定 `did-finish-load` / `did-fail-load` / `render-process-gone`
  - 统一执行 retry / show-error 决策

### Boundaries and dependencies

- `ViewManager` 只负责“何时加载某 URL”与“pane/provider 查询”。
- `PaneLoadMonitor` 负责“失败后如何恢复”。
- `PaneLoadMonitor` 依赖：
  - `paneRecovery.ts`（决策）
  - `paneErrorPage.ts`（错误页）
- 依赖方向变为：
  - `ViewManager -> PaneLoadMonitor -> (paneRecovery, paneErrorPage)`

### Trade-offs

- 采用回调注入而非直接传 `PaneView[]`，避免监控器与 `ViewManager` 内部结构强耦合。
- 保留原有恢复策略常量在 `ViewManager` 侧定义，再通过 options 注入，减少行为回归风险。

## Test plan

- 单测覆盖 `PaneLoadMonitor` 核心分支：
  - 主帧失败的重试路径
  - 达到上限后的错误页回退
  - 成功加载后 attempt reset
  - 非主帧失败忽略
  - `render-process-gone` 恢复路径
- 保持既有 `paneRecovery` / `paneErrorPage` / CLI 相关测试继续通过。

## Implementation notes

- 本次为“第一阶段结构重构”，目标是降低 `ViewManager` 复杂度并稳定行为边界。
- 后续阶段可继续抽离：
  - 快捷键分发
  - prompt 注入调度
  - provider 加载状态通道
