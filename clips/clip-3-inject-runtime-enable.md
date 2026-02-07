---
Author: cctop
Created: 2026-02-07
Updated: 2026-02-07
Status: Draft
Commits: TBD
---

# CLIP-3: Inject Runtime Enablement for Electron Panes

## Problem statement

当前 `lazy-llm` 的 prompt 发送链路是“可调用但不可生效”的状态：

1. Sidebar 调用 `prompt:send` 后，main 仅向 pane 发送 `pane:injectPrompt` 事件。
2. `pane-preload` 只暴露了 `window.paneAPI.onInjectPrompt(...)` 注册能力，但 provider 页面不会主动注册该回调。
3. 仓库内没有实际 DOM 注入 runtime（仅有 provider selectors 配置），因此即使事件送达也没有执行体。
4. `sendPromptToAll` 目前只以“IPC send 是否抛异常”判定成功，无法反映注入是否真的发生，导致假阳性成功。

这会直接导致“输入框可编辑、发送按钮可点击，但目标 pane 无任何 prompt 注入副作用”。

## Non-goals

1. 不在本 CLIP 内实现完整响应抓取与持久化（`extractResponse` 只保留可扩展位）。
2. 不在本 CLIP 内做 provider selector 大规模重写，只修复注入链路可用性。
3. 不在本 CLIP 内引入新的 pane 布局模式或窗口管理策略。
4. 不在本 CLIP 内承诺对所有 provider 的登录态和风控场景一次性全覆盖。

## Design

### Reference baseline

参考 `./llm-council` 中已验证可工作的注入链路：

1. `src/inject/inject.ts`：向页面暴露 `window.__llmBridge.injectPrompt(...)`。
2. `src/inject/core.ts`：统一处理 textarea/contenteditable/Lexical/Quill 注入与事件触发。
3. `src/inject/providers-config.ts`：静态 provider 配置注册，保证构建可内联。
4. `src-tauri/src/manager/webview_manager.rs`：发送 prompt 时执行桥接调用并收集失败原因，而不是 fire-and-forget。

本 CLIP 将复用其核心思想，但落地到 Electron `WebContentsView`。

### Architecture changes

#### 1) 引入 page-world 注入桥

新增 `src/inject/*`（与 `llm-council` 同构）并构建为独立注入脚本，目标是让每个 provider 页面存在：

```ts
window.__llmBridge.injectPrompt(text: string, autoSubmit?: boolean)
```

该桥在页面上下文执行，直接操作 provider DOM，而不是依赖 provider 页面主动调用 preload API。

#### 2) 将 prompt 注入改为“执行 + 回执”

`ViewManager.sendPromptToAll` 从“IPC 单向发送”改为：

1. 对每个 active pane 执行 `webContents.executeJavaScript(...)` 调用 `window.__llmBridge.injectPrompt(...)`。
2. 逐 pane 收集结构化结果（成功/失败/原因）。
3. 将失败信息返回给 `prompt:send` 响应，避免假阳性。

#### 3) 注入脚本生命周期与重试

为每个 pane 维护 bridge 可用状态（导航后自动失效），在以下时机保证桥已注入：

1. pane 创建后首次加载完成。
2. provider 切换后的新页面加载完成。
3. 发送 prompt 前探测桥不存在时执行一次补注入（single retry）。

### Data structures

新增 main 内部结果结构（用于可观测性）：

```ts
interface PaneInjectResult {
  paneIndex: number
  providerKey: string
  success: boolean
  reason?: string
}
```

`prompt:send` 对外响应保持兼容：

```ts
interface PromptResponse {
  success: boolean
  failures?: string[] // e.g. ["pane-1: bridge missing", "pane-2: input not found"]
}
```

说明：先保持 Sidebar runtime 无破坏升级；若后续需要更强可观测性，再在新 CLIP 扩展完整 `results[]` 响应。

### Boundaries and dependencies

1. `src/providers/*/inject.ts` 仍是 selectors 单一来源，不在 Electron main 里重复维护。
2. `src/inject/providers-config.ts` 采用静态 import（避免将 UI icon/组件打进 inject bundle）。
3. `electron/views/manager.ts` 负责注入脚本分发与回执聚合；UI 不直接感知 DOM 细节。
4. `electron/pane-preload.ts` 不再承担核心注入执行，仅保留轻量 bridge 能力（未来可用于 response 事件上报）。

### Security and reliability constraints

1. 保持 `contextIsolation: true`、`nodeIntegration: false` 不变。
2. 注入脚本仅来自本地构建产物，禁止拼接不可信脚本源。
3. prompt 文本必须通过 `JSON.stringify` 序列化后注入，避免脚本字符串注入风险。
4. 对 selector 失败、按钮禁用、bridge 缺失提供可观测错误原因。

## Migration plan

### Phase 1: Inject runtime and build pipeline

1. 新增 `src/inject/inject.ts`、`src/inject/core.ts`、`src/inject/providers-config.ts`。
2. 在构建流程中产出独立 inject bundle（供 main 进程加载/执行）。

### Phase 2: Main-process integration

1. `ViewManager` 增加“注入脚本加载、bridge 探测、prompt 执行、失败聚合”能力。
2. `prompt:send` 返回真实执行结果（失败列表来自 DOM 注入回执）。

### Phase 3: Validation and hardening

1. 增加针对注入链路的单元/集成测试（含脚本转义与失败聚合）。
2. 增加 smoke 的 side-effect 断言（验证目标 pane 实际收到注入，而不只看 UI）。
3. 更新 CLIP 状态与 commits。

## Trade-offs

1. 采用 page-world `__llmBridge` 而非仅 preload 回调
   - 优点：不依赖 provider 页面配合，兼容复杂编辑器 DOM。
   - 代价：需要维护独立 inject bundle 与注入时机。

2. `prompt:send` 保持旧响应结构
   - 优点：降低 renderer 迁移成本。
   - 代价：短期内观测粒度受限（无完整 per-pane 结构化字段）。

3. 加入“发送前补注入”重试
   - 优点：缓解页面重载导致的 bridge 丢失。
   - 代价：实现复杂度略增，需要避免重复注入副作用。

## Test plan

### Unit

1. 注入脚本调用字符串构建：空 prompt 拒绝、特殊字符转义正确。
2. selector 执行失败时返回明确错误，不抛出未处理异常。

### Integration

1. `ViewManager.sendPromptToAll`：成功/部分失败/全失败三种结果聚合正确。
2. provider 切换后导航完成，bridge 会重新可用。

### Electron smoke

1. Sidebar 发送 prompt 后，`prompt:send` 不再“永远成功”。
2. 在可控测试页面中断言输入框值与提交动作确实发生（side-effect assertion）。
3. 回归验证：pane 数量切换、provider 切换后注入链路仍可用。

### Regression gate

1. `make check`
2. `make test`
3. `make test-electron-smoke`

## Definition of done

1. 发送 prompt 能在至少一个 provider 实际注入并触发提交。
2. 注入失败场景能通过 `prompt:send` 返回到 Sidebar（非 silent failure）。
3. 注入链路 smoke 具备 side-effect 断言，不仅是 UI 可见性断言。
4. CLIP 状态更新为 `Implemented`，并补充可读 commits。

## Implementation notes

建议提交切片：

1. `feat(inject): add page-world inject runtime and provider config registry`
2. `feat(electron): execute prompt injection via webContents bridge with result aggregation`
3. `test(inject): add inject pipeline side-effect and failure-path coverage`
4. `chore(clips): mark clip-3 implemented with commit references`
