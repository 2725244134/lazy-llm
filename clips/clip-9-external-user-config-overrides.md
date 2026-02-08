---
Author: cctop
Created: 2026-02-09
Updated: 2026-02-09
Status: Implemented
Commits: feat(config): expose external user config overrides for sidebar, defaults, and zoom
---

# CLIP-9: 用户目录外置配置覆盖（Sidebar/Pane/Zoom）

## Problem statement

当前配置主要存储在加密的 `electron-store` 文件中，用户无法快速直接编辑。  
对于常见调优项（sidebar 宽度、默认 pane 数量与 providers、sidebar/pane zoom），缺少一个“可见、可改、可回滚”的明文入口。

## Non-goals

1. 不替换现有 `electron-store`，仅增加外置覆盖层。
2. 不引入实时热加载（本次仍按启动读取/按需读取）。
3. 不暴露 `collapsed_width` 为外置可调项（保持产品约束：单一 sidebar 宽度值）。

## Design

### Data structures

新增外置配置文件 `~/.config/lazy-llm/config.json`（或 `$XDG_CONFIG_HOME/lazy-llm/config.json`）：

```json
{
  "sidebar": { "expanded_width": 220 },
  "defaults": {
    "pane_count": 3,
    "providers": ["chatgpt", "claude", "gemini"]
  },
  "runtime": {
    "zoom": {
      "pane_factor": 1.0,
      "sidebar_factor": 1.0
    }
  }
}
```

### Boundaries and dependencies

1. `electron/ipc-handlers/externalConfig.ts`
   - 负责路径计算、模板生成、文件读取、覆盖合并、zoom 参数解析。
2. `electron/ipc-handlers/store.ts`
   - `getConfig()`：`store` 配置先归一化，再叠加外置覆盖，再归一化输出。
   - `getRuntimePreferences()`：单独解析 zoom，供 `ViewManager` 使用。
3. `electron/views/manager.ts`
   - pane/sidebar zoom 改为读取 `getRuntimePreferences()` 的结果并应用。

### Trade-offs

1. 选择“覆盖层”而不是迁移所有配置到明文文件：
   - 优点：兼容现有持久化逻辑，风险更低。
   - 代价：存在两层配置来源，需要明确优先级（外置覆盖优先）。
2. 读取策略选择“简单即时读取”：
   - 优点：实现简单、可维护。
   - 代价：暂不支持保存文件后自动热更新。

## Test plan

1. 新增 `externalConfig` 单元测试：
   - 自动创建默认文件
   - 覆盖合并
   - zoom clamp
   - 非法 JSON 容错
2. 全量回归：
   - `make check`
   - `make test`
