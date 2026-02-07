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

需要先定义"布局是什么、如何计算、如何同步、如何验证"，再进入具体实现。

## Non-goals

1. 不在本 CLIP 内实现 provider 注入与 prompt 真实落地。
2. 不在本 CLIP 内讨论移动端布局。
3. 不在本 CLIP 内优化视觉主题，仅定义几何与交互契约。
4. 不要求一次支持多种布局模式（如 2x2）；本阶段固定水平分栏。

## Design

### Architecture: BaseWindow + WebContentsView

**架构选择**：推荐使用 `BaseWindow` + `WebContentsView` 管理多视图。

选择理由：
1. `BrowserWindow` 自身有 `webContents`，叠加 `WebContentsView` 时需要处理 z-order 和事件冲突。
2. `BaseWindow` 无自身渲染进程，所有内容通过 `WebContentsView` 呈现，层级关系更清晰。
3. Electron 30+ 官方推荐多视图场景使用 `BaseWindow`。

备选方案：使用 `BrowserWindow` + `WebContentsView`，但需要额外处理 Sidebar 与 Pane 的层级关系。

窗口结构：

```
BaseWindow (无自身 webContents)
└── contentView
    ├── WebContentsView [sidebar]   ← 左侧固定宽度，加载 Vue 应用
    ├── WebContentsView [pane-0]    ← 右侧区域，加载 provider URL
    ├── WebContentsView [pane-1]
    ├── WebContentsView [pane-2]
    └── WebContentsView [pane-3]
```

每个 `WebContentsView` 的 `bounds` 坐标相对于 `contentView` 左上角。

### Preload 脚本分离

| View | Preload | 职责 |
|------|---------|------|
| sidebar | `electron/preload.ts` | 暴露 `window.council` API，用于 IPC 通信 |
| pane-N | `electron/pane-preload.ts` | 暴露 `window.paneAPI`，用于 prompt 注入和响应提取 |

### Session strategy

All pane views use Electron's default session so authentication state can be shared across panes.

```ts
new WebContentsView({
  webPreferences: {
    // No `partition` override: use defaultSession.
    // ...
  }
})
```

### Layout scope and mode

本 CLIP 先支持单窗口 + 左侧 Sidebar + 右侧 WebView 区：

1. paneCount = 1: 右侧单栏。
2. paneCount = 2: 右侧 1x2 水平分栏。
3. paneCount = 3: 右侧 1x3 水平分栏。
4. paneCount = 4: 右侧 1x4 水平分栏。

布局模式明确为：**始终水平切分，不引入 2x2**。

### Source of truth

1. `main` 进程是几何权威来源（最终矩形由 main 决定并应用）。
2. `sidebar` 通过 IPC 发送布局 hint：`sidebarWidth`、`paneCount`。
3. `main` 根据窗口尺寸和 hint 计算所有 `WebContentsView` 的 bounds。
4. `sidebar` 不能直接设置 WebView bounds，只能发起 `layout:update` 请求。

### Geometry contract

所有 bounds 坐标相对于 `BaseWindow.contentView` 左上角（物理像素）。

**Sidebar bounds**：

- `x = 0`
- `y = 0`
- `width = sidebarWidth`（展开时 280px，折叠时 48px，统一从 config 读取）
- `height = windowHeight`

**Pane 区域**：

- `contentX = sidebarWidth`
- `contentY = 0`
- `contentWidth = max(1, windowWidth - sidebarWidth)`
- `contentHeight = max(1, windowHeight)`

对 `paneCount = N` 的切分规则：

- `baseWidth = floor(contentWidth / N)`
- `remainder = contentWidth % N`
- 第 `i` 个 pane（`0 <= i < N`）
  - `paneWidth(i) = baseWidth + (i < remainder ? 1 : 0)`
  - `paneX(i) = contentX + sum(paneWidth(k), k < i)`
  - `paneY(i) = contentY`
  - `paneHeight(i) = contentHeight`

几何不变量：

1. 连续覆盖：`sidebarWidth + sum(paneWidth) = windowWidth`。
2. 无重叠：`paneX(i+1) = paneX(i) + paneWidth(i)`。
3. 无越界：每个 pane 都落在 `[contentX, windowWidth)`。
4. 最小可见：`paneWidth(i) >= 1`，`paneHeight(i) >= 1`。
5. Sidebar 与 pane 无重叠：`sidebar.x + sidebar.width = pane[0].x`。

### Runtime data structures

```ts
export type PaneCount = 1 | 2 | 3 | 4

// Sidebar 发送给 main 的布局请求
export interface LayoutUpdateRequest {
  sidebarWidth: number      // sidebar 当前宽度
  paneCount: PaneCount      // 目标 pane 数量
}

// main 内部使用的 View 信息
export interface ViewRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PaneState {
  paneIndex: number
  bounds: ViewRect
  providerKey: string
  url: string
}

// 完整布局快照（用于测试和调试）
export interface LayoutSnapshot {
  windowWidth: number
  windowHeight: number
  sidebar: ViewRect
  paneCount: PaneCount
  panes: PaneState[]
}
```

### View 管理

```ts
// electron/views/manager.ts
export interface ViewManager {
  // 初始化 sidebar view
  initSidebar(): WebContentsView

  // 设置 pane 数量（创建/销毁 WebContentsView）
  setPaneCount(count: PaneCount): void

  // 更新指定 pane 的 provider
  updatePaneProvider(paneIndex: number, providerKey: string): void

  // 重新计算并应用所有 view 的 bounds
  updateLayout(sidebarWidth: number): void

  // 获取当前布局快照
  getSnapshot(): LayoutSnapshot

  // 向所有 pane 发送 prompt
  sendPromptToAll(text: string): Promise<void>
}
```

### IPC contract changes

在现有 `app:health/config:get/pane:setCount/pane:updateProvider/prompt:send` 基础上修改和新增：

**修改**（简化请求参数，main 自己知道窗口尺寸）：

1. `layout:update`
   - request: `LayoutUpdateRequest` (`{ sidebarWidth, paneCount }`)
   - response: `{ success: boolean }`
   - 说明：sidebar 通知 main 重新计算布局

**新增**：

2. `layout:getSnapshot`
   - request: `void`
   - response: `LayoutSnapshot`
   - 说明：用于 smoke 测试和调试断言

**Pane 专用通道**（pane-preload 使用）：

3. `pane:injectPrompt`（main → pane，单向）
   - payload: `{ text: string }`
   - 说明：main 向指定 pane 发送 prompt 注入指令

4. `pane:responseReady`（pane → main）
   - payload: `{ paneIndex: number, response: string }`
   - 说明：pane 向 main 报告响应完成

### Event and sync timing

**Sidebar 触发 `layout:update` 的时机**：

1. Sidebar 挂载完成后首次同步。
2. paneCount 变化后（用户点击 1/2/3/4）。
3. sidebar 折叠/展开后（sidebarWidth 变化）。

**Main 触发重算的时机**：

1. 收到 `layout:update`。
2. 主窗口 resize 事件（`BaseWindow.on('resize')`）。

**布局更新流程**：

```
┌─────────────┐   layout:update   ┌──────────────┐
│  Sidebar    │ ────────────────► │    Main      │
│ (renderer)  │                   │  (process)   │
└─────────────┘                   └──────────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │ ViewManager      │
                              │ .updateLayout()  │
                              └──────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
            ┌───────────┐       ┌───────────┐       ┌───────────┐
            │ sidebar   │       │  pane-0   │       │  pane-N   │
            │ .setBounds│       │ .setBounds│       │ .setBounds│
            └───────────┘       └───────────┘       └───────────┘
```

### WebView lifecycle rules

1. **Sidebar view**：应用启动时创建，生命周期与窗口一致，不销毁。
2. **Pane views**：
   - 当前 active pane 数量 = `paneCount`。
   - 当 pane 数量减少：多余 WebContentsView 从 contentView 移除并销毁。
   - 当 pane 数量增加：按 `paneIndex` 顺序创建新 WebContentsView。
   - provider 切换只调用 `webContents.loadURL()`，不销毁 view。
3. **Shared default session**: pane views do not set a custom partition, so login state is reused across panes.

### Boundaries and dependencies

1. `src/components/sidebar/*` 只负责用户意图，不包含几何算法。
2. 几何算法统一放在 `electron/views/manager.ts`。
3. `src/runtime/sidebar/electronRuntime.ts` 只负责调用 IPC，不复制计算逻辑。
4. 测试通过 `layout:getSnapshot` 断言，不读取实现私有状态。

### File structure changes

```
electron/
├── main.ts                    # 入口，使用 BaseWindow
├── preload.ts                 # sidebar 用，暴露 window.council
├── pane-preload.ts            # pane 用，暴露 window.paneAPI (新增)
├── ipc/
│   └── contracts.ts           # IPC 通道和类型定义 (更新)
└── views/
    ├── manager.ts             # ViewManager 实现 (新增)
    └── geometry.ts            # 几何计算纯函数 (新增)
```

## Trade-offs

1. **BaseWindow 替代 BrowserWindow**
   - 优点：多视图架构清晰，无渲染层级冲突。
   - 代价：需要为 sidebar 单独创建 WebContentsView，代码量略增。

2. **Sidebar 作为独立 WebContentsView**
   - 优点：与 pane views 同级管理，布局统一由 main 控制。
   - 代价：sidebar 和 pane 都需要各自的 preload 脚本。

3. **Main 作为布局权威**
   - 优点：单一事实来源，避免渲染层与壳层漂移。
   - 代价：每次布局变化需要 IPC 调用。

4. **Shared default session**
   - Benefit: users sign in once and can reuse the same authenticated state in every pane.
   - Cost: less isolation; logout/account-switch actions can impact all panes.

5. **只支持水平分栏**
   - 优点：先把契约做稳定，降低复杂度。
   - 代价：2x2 之类模式延后到后续 CLIP。

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

### 关键代码示例

**main.ts 核心变更**：

```ts
import { app, BaseWindow, WebContentsView } from 'electron';
import { ViewManager } from './views/manager.js';

let mainWindow: BaseWindow;
let viewManager: ViewManager;

function createWindow() {
  // 使用 BaseWindow，不是 BrowserWindow
  mainWindow = new BaseWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
  });

  viewManager = new ViewManager(mainWindow);
  viewManager.initSidebar();
  viewManager.setPaneCount(1);

  // 窗口 resize 时更新布局
  mainWindow.on('resize', () => {
    viewManager.updateLayout();
  });
}
```

**pane-preload.ts 示例**：

```ts
import { contextBridge, ipcRenderer } from 'electron';

// paneIndex 由 main 进程在创建时注入到 webContents
const paneIndex = parseInt(process.argv.find(arg => arg.startsWith('--pane-index='))?.split('=')[1] ?? '0');

const paneAPI = {
  onInjectPrompt: (callback: (text: string) => void) => {
    ipcRenderer.on('pane:injectPrompt', (_event, { text }) => callback(text));
  },
  reportResponse: (response: string) => {
    ipcRenderer.send('pane:responseReady', { paneIndex, response });
  },
};

contextBridge.exposeInMainWorld('paneAPI', paneAPI);
```

### 建议提交切片

1. `refactor(electron): migrate from BrowserWindow to BaseWindow`
2. `feat(views): add ViewManager with sidebar and pane WebContentsView`
3. `feat(layout): add geometry calculation and IPC contracts`
4. `feat(pane): add pane-preload for prompt injection`
5. `test(layout): add geometry unit tests and smoke assertions`
