---
Author: cctop
Created: 2026-02-07
Updated: 2026-02-07
Status: Draft
Commits: TBD
---

# CLIP-1: Sidebar Migration with UI/Feature Parity

## Problem statement

`lazy-llm` 已完成 Electron 基础骨架，但 Sidebar 的迁移目标需要明确：

1. 保持原项目 Sidebar 的 UI 一致性（视觉结构与交互位置不漂移）。
2. 保持原项目 Sidebar 的 feature 一致性（pane/provider/prompt 行为不回退）。
3. 允许实现层重构，以降低 renderer 与桌面壳 IPC 的耦合。

如果只做“调用替换”而不定义契约，后续维护会持续出现跨层修改、错误难定位和 smoke 用例脆弱的问题。

## Non-goals

1. 不在本 CLIP 内做 Sidebar 视觉重设计。
2. 不新增产品 feature（例如更多布局模式、更多 provider 类型）。
3. 不在本 CLIP 内重写 Inject 全链路，只覆盖 Sidebar 可见路径。
4. 不要求一次性删除所有历史兼容代码，允许阶段性并存后清理。

## Design

### Parity contract

#### UI parity

1. Sidebar 展开/收起行为、宽度和动画节奏保持一致。
2. Pane selector（1/2/3/4）布局、交互反馈、禁用态保持一致。
3. Provider list 与 per-pane provider dropdown 的视觉位置和顺序保持一致。
4. Prompt composer（输入框、发送按钮、快捷键提示）保持一致。
5. 错误提示区（若出现）显示时机和文案语义保持一致。

#### Feature parity

1. `setPaneCount` 可立即生效，且驱动布局同步。
2. `updateProvider` 在 pane 维度更新 provider 并保持状态。
3. `Ctrl/Cmd + Enter` 触发发送，发送后输入框行为与基线一致。
4. `sendPrompt` 仅向 active panes 广播。
5. 运行时失败需可观察（UI 错误或结构化日志），不允许 silent catch。

### Data structures

定义 Sidebar runtime 适配契约，隔离 UI 与具体 IPC 实现：

```ts
export interface SidebarRuntime {
  getConfig(): Promise<AppConfig>
  setPaneCount(count: 1 | 2 | 3 | 4): Promise<void>
  updateProvider(paneIndex: number, providerKey: string, totalPanes: 1 | 2 | 3 | 4): Promise<void>
  updateLayout(args: {
    viewportWidth: number
    viewportHeight: number
    paneCount: 1 | 2 | 3 | 4
    sidebarWidth: number
  }): Promise<void>
  sendPrompt(text: string): Promise<void>
}
```

建议文件落点：

1. `src/runtime/sidebar/types.ts`：定义 `SidebarRuntime`。
2. `src/runtime/sidebar/electronRuntime.ts`：基于 `window.electron`/`window.council` 的实现。
3. `src/runtime/sidebar/index.ts`：runtime factory。

### Boundaries and dependencies

1. `src/components/sidebar/Sidebar.vue` 只依赖 `SidebarRuntime`，不直接依赖 Electron API。
2. Electron 通道常量与 payload 由 `electron/ipc/contracts.ts` 单点维护。
3. preload 暴露的 bridge 与 renderer 类型在 `src/types/electron.d.ts` 同步。
4. runtime 层负责异常分类，UI 层只负责展示可行动错误信息。

### Refactor allowance

以下重构在本 CLIP 中视为允许：

1. 将 `Sidebar.vue` 的副作用逻辑抽离到 composable/controller。
2. 拆分大函数（layout sync、prompt send、provider switch）。
3. 重命名变量和方法以提升可读性（行为保持不变）。
4. 合并重复 IPC 调用路径，统一错误处理。

## Migration plan

### Phase 0: Baseline freeze

1. 为 Sidebar 当前行为建立截图和交互 checklist。
2. 固化关键 `data-testid`（避免迁移中测试锚点漂移）。

### Phase 1: Adapter-first refactor

1. 新建 `src/runtime/sidebar/` 并引入 `SidebarRuntime`。
2. Sidebar 先接入 adapter，不改用户行为。

### Phase 2: Electron bridge alignment

1. 对齐 `electron/ipc/contracts.ts` 与 preload bridge。
2. 确保 `setPaneCount/updateProvider/updateLayout/sendPrompt` 四条链路语义一致。
3. 清理 Sidebar 内部直接 IPC 调用。

### Phase 3: Parity validation and cleanup

1. 执行 unit/component/electron smoke 全量验证。
2. 清理迁移期间的临时兼容路径。
3. 更新 CLIP 状态与 Commits。

## Trade-offs

1. 先做 adapter 再迁移
   - 优点：可测试、可回滚。
   - 代价：短期文件数量增加。
2. 允许重构而非逐行搬运
   - 优点：后续维护成本更低。
   - 代价：需要更严格 parity 检查避免行为漂移。
3. 先守住 UI/Feature 一致，再做增强
   - 优点：用户感知风险最低。
   - 代价：新需求进入下一阶段 CLIP。

## Test plan

### Unit

1. `SidebarRuntime` contract tests。
2. 错误路径测试（runtime 抛错时 UI 是否感知）。

### Component

1. Sidebar 展开/收起渲染测试。
2. pane/provider/prompt 关键交互测试。

### Electron smoke

1. 启动应用后 Sidebar 主体可见。
2. `1 -> 2 -> 3 -> 4` pane 切换成功。
3. provider 切换后 UI 与状态一致。
4. prompt 发送路径可达，失败时可观察。

### Regression gate

1. `make check`
2. `make test`
3. `make test-electron-smoke`

## Definition of done

1. Sidebar UI 基线对比无可见回归。
2. Sidebar feature parity checklist 全部通过。
3. Electron 路径 smoke 测试通过。
4. 所有迁移提交符合 conventional commits 并可追踪。

## Implementation notes

建议提交切片：

1. `refactor(sidebar): introduce runtime adapter boundary`
2. `feat(sidebar): wire electron runtime for pane provider and prompt flows`
3. `test(sidebar): add parity checks for ui and feature behavior`
4. `chore(sidebar): remove temporary compatibility paths`
