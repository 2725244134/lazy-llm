---
Author: cctop
Created: 2026-02-09
Updated: 2026-02-09
Status: Implemented
Commits: feat(theme): extract rosepine theme tokens for sidebar and quick prompt
---

# CLIP-10: Quick Prompt 与 Sidebar 配色模块化（Rosé Pine）

## Problem statement

当前配色散落在多个文件中（`src/App.vue`、`src/components/sidebar/*`、`src/components/ui/Select.vue`、`electron/views/quick-prompt/styles.ts`），并且存在大量硬编码色值。  
这导致：

1. Quick Prompt 与 Sidebar 无法共享统一主题语义。
2. 改色需要跨文件搜索替换，容易漏改。
3. 无法形成“单点配置”的可维护配色入口。

## Non-goals

1. 不改 IPC 协议与持久化配置结构。
2. 不引入运行时主题切换 UI。
3. 不改动布局结构和交互流程，仅调整配色与轻度视觉质感。

## Design

### Data structures

新增 `src/theme/palette.ts`：

1. `ThemePresetKey`（当前单一 preset：`rosePineMain`）。
2. `ThemePreset`（拆分 `sidebarVars` 与 `quickPromptVars`）。
3. `getSidebarThemeVars` / `getQuickPromptThemeVars`。
4. `renderCssVariableBlock`（将 token map 序列化为 CSS 变量块）。

### Boundaries and dependencies

1. Sidebar 侧：在 `src/components/sidebar/Sidebar.vue` 通过内联 style 注入主题变量作用域，子组件自动继承。
2. Quick Prompt 侧：`electron/views/quick-prompt/styles.ts` 从同一 token 源生成 `:root` 变量块。
3. 仅在表现层（CSS vars）建立依赖，不影响 runtime 与 IPC 模块。

### Trade-offs

1. 选择单 preset（`Rosé Pine Main`）而不是多主题切换：
   - 优点：改动面小、回归风险低。
   - 代价：暂不支持运行时切换。
2. 选择局部变量覆盖 Sidebar，而非全局替换 `:root`：
   - 优点：避免影响主内容区，符合范围约束。
   - 代价：主题作用域需要在 Sidebar 根节点显式注入。

## Test plan

1. 新增 `src/theme/palette.test.ts`：
   - 验证关键 token 存在且值正确。
   - 验证 CSS 变量块序列化结果。
2. 新增 `electron/views/quick-prompt/styles.test.ts`：
   - 验证 quick prompt 样式含主题变量。
   - 验证移除 `prefers-color-scheme` 分支（固定 `Main Only`）。
3. 回归执行：
   - `make check`
   - `make test`
   - `make test-electron-smoke`

## Implementation notes

1. 把 Sidebar 与 Quick Prompt 的硬编码颜色替换为语义变量，减少后续改色成本。
2. Quick Prompt 的色值不再内联在模板字符串中，改为共享 token 构建，保证两端一致性。
