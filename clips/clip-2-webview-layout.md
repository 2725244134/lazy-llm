---
Author: cctop
Created: 2026-02-07
Updated: 2026-02-07
Status: Draft
Commits: TBD
---

# CLIP-2: WebView Layout Contract (1~4 Panes + Sidebar)

## Problem statement

当前 `lazy-llm` 的主区域仍是 placeholder，虽然 Sidebar 已具备 `pane_count` 与 provider 选择能力，但缺少一份明确的 WebView 布局契约，导致以下风险：

1. renderer/main 对布局语义理解不一致（谁负责算尺寸、谁负责应用）。
2. 1/2/3/4 pane 切换时易出现重叠、缝隙、抖动和越界。
3. 侧栏折叠/展开与窗口 resize 后，WebView 区域无法稳定同步。
4. 后续 smoke 测试缺少可断言的几何标准。

需要先定义“布局是什么、如何计算、如何同步、如何验证”，再进入具体实现。

## Non-goals

1. 不在本 CLIP 内实现 provider 注入与 prompt 真实落地。
2. 不在本 CLIP 内讨论移动端布局。
3. 不在本 CLIP 内优化视觉主题，仅定义几何与交互契约。
4. 不要求一次支持多种布局模式（如 2x2）；本阶段固定水平分栏。

## Design

### Layout scope and mode

本 CLIP 先支持单窗口 + 左侧 Sidebar + 右侧 WebView 区：

1. paneCount = 1: 右侧单栏。
2. paneCount = 2: 右侧 1x2 水平分栏。
3. paneCount = 3: 右侧 1x3 水平分栏。
4. paneCount = 4: 右侧 1x4 水平分栏。

布局模式明确为：**始终水平切分，不引入 2x2**。

### Source of truth

1. `main` 进程是几何权威来源（最终矩形由 main 决定并应用）。
2. `renderer` 提供布局 hint：`viewportWidth`、`viewportHeight`、`sidebarWidth`、`paneCount`。
3. `renderer` 不能直接设置 WebView bounds，只能发起 `updateLayout` 请求。

### Geometry contract

定义逻辑坐标（CSS px）下的内容区：

- `contentX = sidebarWidth`
- `contentY = 0`
- `contentWidth = max(1, viewportWidth - sidebarWidth)`
- `contentHeight = max(1, viewportHeight)`

对 `paneCount = N` 的切分规则：

- `baseWidth = floor(contentWidth / N)`
- `remainder = contentWidth % N`
- 第 `i` 个 pane（`0 <= i < N`）
  - `paneWidth(i) = baseWidth + (i < remainder ? 1 : 0)`
  - `paneX(i) = contentX + sum(paneWidth(k), k < i)`
  - `paneY(i) = contentY`
  - `paneHeight(i) = contentHeight`

几何不变量：

1. 连续覆盖：所有 pane 宽度和等于 `contentWidth`。
2. 无重叠：`paneX(i+1) = paneX(i) + paneWidth(i)`。
3. 无越界：每个 pane 都落在 `[contentX, contentX + contentWidth)`。
4. 最小可见：`paneWidth(i) >= 1`，`paneHeight(i) >= 1`。

### Runtime data structures

```ts
export type PaneCount = 1 | 2 | 3 | 4

export interface ViewportLayoutHint {
  viewportWidth: number
  viewportHeight: number
  sidebarWidth: number
  paneCount: PaneCount
}

export interface PaneRect {
  paneIndex: number
  x: number
  y: number
  width: number
  height: number
  providerKey: string
}

export interface LayoutSnapshot {
  viewportWidth: number
  viewportHeight: number
  sidebarWidth: number
  paneCount: PaneCount
  contentX: number
  contentWidth: number
  panes: PaneRect[]
}
```

### IPC contract changes

在现有 `app:health/config:get/pane:setCount/pane:updateProvider/prompt:send` 基础上新增：

1. `layout:update`
   - request: `ViewportLayoutHint`
   - response: `{ success: boolean }`
2. `layout:getSnapshot`
   - request: `void`
   - response: `LayoutSnapshot`

说明：

1. `layout:update` 用于 renderer 主动同步（首屏、sidebar toggle、pane switch、resize）。
2. `layout:getSnapshot` 用于 smoke 测试和调试断言，不给业务逻辑使用。

### Event and sync timing

`renderer` 触发 `layout:update` 的时机：

1. `Sidebar` 挂载完成后首次同步。
2. paneCount 变化后。
3. sidebar 折叠/展开后。
4. `window.resize`（`requestAnimationFrame` 节流）。

`main` 触发重算的时机：

1. 收到 `layout:update`。
2. 主窗口尺寸变化（作为兜底）。

### WebView lifecycle rules

1. 当前 active pane 数量 = `paneCount`。
2. 当 pane 数量减少：多余 WebView 进入 detached/hidden 状态（由实现决定），但状态处理需可预测。
3. 当 pane 数量增加：缺失 pane 按 `paneIndex` 顺序创建。
4. provider 切换只影响目标 pane，不触发布局重排。

### Boundaries and dependencies

1. `src/components/sidebar/*` 只负责用户意图，不包含几何算法。
2. 几何算法统一放在 `electron` 侧 layout manager（例如 `electron/layout/manager.ts`）。
3. `src/runtime/sidebar/electronRuntime.ts` 只负责调用 IPC，不复制计算逻辑。
4. 测试通过 `layout:getSnapshot` 断言，不读取实现私有状态。

## Trade-offs

1. main 作为布局权威
   - 优点：单一事实来源，避免渲染层与壳层漂移。
   - 代价：IPC 调用次数增加。
2. 只支持水平分栏
   - 优点：先把契约做稳定，降低复杂度。
   - 代价：2x2 之类模式延后。
3. 增加 debug snapshot channel
   - 优点：可测试性和可观测性显著提升。
   - 代价：新增一条维护接口。

## Test plan

### Unit

1. 几何算法测试：1/2/3/4 panes 下连续覆盖与无重叠。
2. 边界测试：极小窗口、极端 sidebar 宽度、非法输入归一化。

### Integration

1. `layout:update` 后 `layout:getSnapshot` 与请求语义一致。
2. paneCount 改变时 active pane 数量与 snapshot 一致。

### Electron smoke

1. 启动后 `layout:getSnapshot` 返回有效 `panes`。
2. `1 -> 2 -> 3 -> 4` 切换后 snapshot 几何契约持续成立。
3. sidebar 折叠/展开后 `contentX/contentWidth` 变化正确。
4. resize 后 snapshot 仍满足连续覆盖。

### Regression gate

1. `make check`
2. `make test`
3. `make test-electron-smoke`

## Definition of done

1. WebView 布局算法与 IPC 契约已落地并可重复验证。
2. `layout:getSnapshot` 能覆盖 smoke 所需断言数据。
3. 1~4 panes + sidebar toggle + resize 三类场景稳定通过。
4. 与 CLIP-1 的 Sidebar runtime 契约保持一致，无额外绕行逻辑。

## Implementation notes

建议提交切片：

1. `feat(layout): add typed layout ipc contract and snapshot`
2. `feat(layout): implement main-process pane geometry manager`
3. `refactor(sidebar): trigger layout sync through runtime adapter`
4. `test(layout): add geometry unit tests and smoke assertions`
