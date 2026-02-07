---
Author: cctop
Created: 2026-02-08
Updated: 2026-02-08
Status: Implemented
Commits: TBD
---

# CLIP-4: Live Prompt Draft Sync from Sidebar to Pane Inputs

## Problem statement

当前 Sidebar 的 prompt 输入框只在点击 `SEND` 后才注入到 pane 网页输入框。用户在 Sidebar 中输入/删除时，目标 LLM 网页输入框不会动态跟随，导致：

1. Sidebar 与各 pane 的输入状态不一致。
2. 用户无法在发送前确认每个 pane 的实际输入状态。
3. 删除/修改文本的即时反馈缺失。

## Non-goals

1. 不实现从 pane 网页回传输入内容到 Sidebar 的双向同步。
2. 不改变现有 `SEND` 提交语义（仍然由 `prompt:send` 负责提交）。
3. 不在本 CLIP 中引入新的 provider selector 规则。

## Design

### 1) 新增 draft 同步 IPC 通道

新增 `prompt:syncDraft` 通道，用于“仅注入，不提交”的实时同步。

- request: `{ text: string }`
- response: `{ success: boolean; failures?: string[] }`

### 2) ViewManager 提供独立 draft 同步入口

新增 `syncPromptDraftToAll(text)`，复用现有注入脚本执行链路，但调用：

```ts
window.__llmBridge.injectPrompt(text, false)
```

关键点：

1. `autoSubmit=false`，确保只更新输入框不点击发送。
2. 允许空字符串，支持“删除到空”的同步清空。

### 3) Sidebar runtime/context 暴露 `syncPromptDraft`

在 renderer 侧新增 `syncPromptDraft` 能力，供 `PromptComposer` 在输入变化时调用。

### 4) PromptComposer 实时同步策略

在输入变化时执行实时同步，但采用“短防抖 + 顺序 flush”策略：

1. 防抖降低高频 IPC 压力。
2. 串行执行避免乱序覆盖。
3. 发送成功后清空本地输入时，跳过一次 draft 同步，避免与提交动作竞态。

## Test plan

1. `promptInjection` 单测新增 draft 构建函数测试：
   - 允许空字符串。
   - 明确使用 `autoSubmit=false`。
2. `electronRuntime` 单测新增 draft 通道转发验证。
3. 回归执行：
   - `make check`
   - `make test`

## Outcome

已实现“Sidebar 输入框内容动态跟随显示到 pane 网页输入框（增删即时同步）”，且保持现有 `SEND` 提交流程不变。
