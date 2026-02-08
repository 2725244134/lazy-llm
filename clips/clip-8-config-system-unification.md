---
Author: cctop
Created: 2026-02-09
Updated: 2026-02-09
Status: Implemented
Commits: refactor(config): centralize constants with domain-based APP_CONFIG
---

# CLIP-8: 配置系统集中化与分域治理（B+C）

## Problem statement

当前项目中的“可调参数/常量”分散在 Electron main、view manager、renderer 组件与 quick prompt 注入脚本中，存在以下问题：

1. 同一语义的常量重复定义（如快捷键事件名、draft sync 节流参数）。
2. 默认值散落，无法在一个入口看到系统配置全貌。
3. 修改配置时缺乏边界，容易造成跨模块行为漂移。

在项目尚未 release、无需兼容历史配置迁移的阶段，适合一次性重构为集中式配置系统。

## Non-goals

1. 不引入 migration/versioning 机制。
2. 不改变现有业务行为与默认值。
3. 不调整 provider 注入逻辑与 UI 视觉设计。

## Design

### Data structures

新增 `src/config` 配置域，按职责拆分：

1. `layout.ts`
   - Pane 数量限制、Sidebar 尺寸、Quick Prompt 几何参数、PromptComposer 高度参数。
2. `interaction.ts`
   - 快捷键事件名、draft sync debounce、send-clear guard。
3. `runtime.ts`
   - pane accept languages、zoom 默认值。
4. `providers.ts`
   - provider 元数据目录、默认 active providers、默认 pane providers。
5. `app.ts`
   - 顶层只读配置对象 `APP_CONFIG`，聚合以上分域配置。
6. `index.ts`
   - 对外统一导出。

### Boundaries and dependencies

1. `src/config/*` 作为唯一配置真源（single source of truth）。
2. Electron 与 renderer 均依赖 `APP_CONFIG` 读取默认值，不再在业务模块内写死常量。
3. 允许保留极少数“协议常量”在其专属域（例如 `IPC_CHANNELS` 继续在 `electron/ipc/contracts.ts`）。

### Trade-offs

1. 采用“分域模块 + 顶层聚合”的 B+C 方案，而非单文件大常量表。
   - 优点：查找路径清晰，后续扩展不拥挤。
   - 代价：初期 import 调整量更大。
2. 当前阶段不做配置迁移。
   - 优点：快速落地，避免过度设计。
   - 代价：未来 release 后若改配置结构，再引入 migration CLIP。

## Test plan

1. `make check`
2. `make test`
3. 手工验证关键路径常量是否保持原值：
   - pane/sidebar zoom
   - sidebar toggle shortcut event
   - prompt composer / quick prompt 的 draft sync 参数

## Implementation notes

1. 优先消除重复常量，再处理默认值散点。
2. 重构过程中避免跨文件并发修改同一文件，按“配置域 -> 依赖方接线”的顺序落地。
