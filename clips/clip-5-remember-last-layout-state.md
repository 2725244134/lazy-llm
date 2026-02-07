---
Author: cctop
Created: 2026-02-08
Updated: 2026-02-08
Status: Implemented
Commits: 21ca4b7
---

# CLIP-5: Remember Last Pane Layout State Across App Restarts

## Problem statement

当前应用每次启动都会回到默认 `pane_count=2` 和默认 providers（`chatgpt`、`claude`）。
用户在上一次会话中选择的 pane 数量和 provider 组合不会被持久化。

## Non-goals

1. 不实现 prompt 文本草稿的跨重启恢复。
2. 不实现 pane 内网页滚动位置或聊天上下文恢复。
3. 不改变现有 config normalization 策略。

## Design

1. 在 `electron/ipc-handlers/store.ts` 新增写入函数：
   - `setDefaultPaneCount(paneCount)`
   - `setDefaultProvider(paneIndex, providerKey)`
2. 在 `electron/main.ts` 的 IPC handlers 中接入写回：
   - `pane:setCount` 成功后写回 `defaults.pane_count`
   - `pane:updateProvider` 成功后写回 `defaults.providers[paneIndex]`
3. 所有写入都经过 `normalizeConfig`，保证 provider key 和 pane_count 范围合法。

## Test plan

1. 回归执行：
   - `make check`
   - `make test`
2. 手动验证：
   - 切换 pane 数量和 provider
   - 重启应用后确认状态恢复

## Outcome

应用启动时将基于上一次用户选择的 pane 数量与 provider 组合恢复，而不再固定回到默认值。
