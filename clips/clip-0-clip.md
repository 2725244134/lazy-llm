---
Author: cctop
Created: 2026-02-07
Updated: 2026-02-07
Status: Draft
Commits: TBD
---

# CLIP-0: Electron Bootstrap Setup and Baseline Convention Migration

## Problem statement

`lazy-llm` 需要先建立一个稳定、可验证、可发布的 Electron 基础工程骨架，再在其上逐步迁移功能（从 Sidebar 开始）。

本 CLIP 关注“先搭底座再迁移功能”：

1. 统一 Electron main/preload/renderer 的基础边界。
2. 固定 Bun-only 开发与构建流程，避免包管理器混用。
3. 迁移并固化项目基础规范（命令入口、CLIP 流程、测试门禁）。

## Non-goals

1. 不在本 CLIP 内完成所有业务迁移（provider/inject/布局细节后续 CLIP 处理）。
2. 不在本 CLIP 内追求平台签名、公证、自动更新的完整生产方案。
3. 不重写现有 UI 视觉设计。

## Design

### Target architecture (bootstrap)

1. `electron/main.ts`：窗口生命周期、IPC handler 注册、打包入口。
2. `electron/preload.ts`：`contextBridge` 白名单 API 暴露层。
3. `electron/ipc/contracts.ts`：channel 和 payload 单点定义。
4. `src/`：Vue renderer，仅通过 `window.electron`/`window.council` 访问桌面能力。
5. `tests/electron/smoke.test.ts`：最小桌面回归。

### Package manager policy (Bun-only)

1. JavaScript package manager 强制使用 `bun`。
2. 禁止在 setup/dev/build/test/release 中使用 `npm`、`yarn`、`pnpm`。
3. 一次性 CLI 统一使用 `bunx`（如 `bunx electron-rebuild`）。
4. lockfile 仅允许 `bun.lock`。

### Borrowed from `&electron-base` skill

1. Security baseline
   - `contextIsolation: true`
   - `nodeIntegration: false`
   - preload 只暴露受控 API，不暴露原始 `ipcRenderer`
2. Typed IPC baseline
   - request/response 使用明确 payload 类型
   - channel 常量集中，避免魔法字符串
3. Build baseline
   - renderer 输出 `dist/`
   - electron 输出 `dist-electron/`
   - `package.json#main` 指向 `dist-electron/main.mjs`
4. Native module readiness
   - 如接入 `better-sqlite3`，必须 `bunx electron-rebuild` 并在 Vite externalize

### Baseline convention migration

1. 单一命令入口：`Makefile`（prepare/dev/check/test/build/package）。
2. CLIP 流程文件：`clips/AGENTS.md`。
3. 文档流程：非 trivial 变更先写 CLIP 再实现。
4. 提交规范：Conventional Commits。

## Step-by-step setup

### Step 1: Prepare runtime and dependencies

- Goal: 确保 Electron + Vue + TypeScript 依赖可用。
- Files:
  - `package.json`
  - `bun.lock`
- Commands:

```bash
make prepare
```

- Expected result: 依赖安装完成。
- Failure signal: `bun install` 失败或 lockfile 冲突。

### Step 2: Validate Electron process boundaries

- Goal: 确认 main/preload/renderer 分层生效。
- Files:
  - `electron/main.ts`
  - `electron/preload.ts`
  - `src/types/electron.d.ts`
- Commands:

```bash
make dev
```

- Expected result: 应用可启动，renderer 可通过 bridge 访问 IPC API。
- Failure signal: preload 未加载、`window.electron` 未定义、白屏。

### Step 3: Validate IPC bootstrap contract

- Goal: 验证基础 IPC 通道可用。
- Files:
  - `electron/ipc/contracts.ts`
  - `electron/ipc-handlers/store.ts`
- Commands:

```bash
make test-electron-smoke
```

- Expected result: smoke 测试可调通基础 channel。
- Failure signal: `channel not found`、invoke 超时、handler 抛错。

### Step 4: Validate engineering gate

- Goal: 建立最小质量门禁。
- Files:
  - `Makefile`
  - `tests/electron/smoke.test.ts`
- Commands:

```bash
make check
make test
make test-electron-smoke
```

- Expected result: typecheck/unit/smoke 全部通过。
- Failure signal: 任一环节失败即阻断后续迁移。

### Step 5: Validate build and package path

- Goal: 确保可产出桌面构建物。
- Files:
  - `package.json`
  - `vite.config.ts`
- Commands:

```bash
make build
make package
```

- Expected result: `dist/` 与 `dist-electron/` 产物完整，`release/` 包可生成。
- Failure signal: main 入口缺失、打包配置错误、平台依赖缺失。

## IPC contract (bootstrap)

建议保持以下最小通道稳定：

1. `app:health`
2. `config:get`
3. `pane:setCount`
4. `pane:updateProvider`
5. `prompt:send`

错误约束：

1. main 统一返回结构化错误。
2. preload 不吞错，保留错误语义。
3. renderer 仅展示可行动错误并记录日志。

## Validation checklist

1. Electron 能稳定启动与退出。
2. `contextIsolation=true` 且 `nodeIntegration=false`。
3. renderer 不直接访问 Node API。
4. Bun-only 流程可覆盖开发、测试、打包。
5. smoke 能覆盖主路径并可重复执行。

## Failure playbook

1. 启动白屏
   - 检查 `BrowserWindow` 加载地址和 preload 路径。
2. bridge 不可用
   - 检查 `contextBridge.exposeInMainWorld` 与 `src/types/electron.d.ts` 是否一致。
3. IPC 失败
   - 检查 contracts 常量与 handler 注册是否一致。
4. 打包失败
   - 检查 `build.files`、`main` 入口和平台依赖。
5. 原生模块 ABI 问题
   - 执行 `bunx electron-rebuild -f -w better-sqlite3`。

## Test plan

1. Unit: preload API + IPC payload 类型约束。
2. Integration: main/preload/renderer 基础链路。
3. Desktop smoke: 启动、基础 channel、UI 主体可见。
4. Build verification: `make build` + `make package`。

## Definition of done

1. setup 全流程可在新机器按命令复现。
2. Bun-only 约束落地，无其他包管理器命令。
3. check/test/smoke/build/package 形成稳定门禁。
4. `clips/AGENTS.md` 与 `clip-0` 同步作为后续迁移入口文档。
