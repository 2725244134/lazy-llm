# Raw Capture States

该目录用于保存每个 provider 的多状态 raw HTML。

```text
tests/fixtures/raw/<provider>/
  idle.html
  send-ready.html
  streaming.html
  complete.html
  manifest.json
```

支持的 provider：

- `chatgpt` (`https://chatgpt.com/`)
- `claude` (`https://claude.ai/`)
- `gemini` (`https://gemini.google.com/`)
- `grok` (`https://grok.com/`)
- `perplexity` (`https://www.perplexity.ai/`)
- `aistudio` (`https://aistudio.google.com/prompts/new_chat`)

## 唯一抓取入口：actionbook

`raw` 抓取必须通过 `actionbook` 完成，`--input` 只接受 `actionbook browser html` 导出的 HTML 文件。

## 4 状态定义

- `idle`: 新会话、输入框为空、尚未输入 prompt。
- `send-ready`: 输入框有文本，发送按钮可点击，但尚未发送。
- `streaming`: 已发送，模型正在流式输出（通常可见 Stop 按钮）。
- `complete`: 本轮回答结束，进入完成态（通常可见 Copy/Retry/Feedback 等操作）。

推荐按顺序执行：`idle -> send-ready -> streaming -> complete`。

## actionbook 命令模板（四状态）

先打开真实页面：

```bash
actionbook browser open "<provider-url>"
```

### 1) idle

```bash
actionbook browser snapshot
actionbook browser eval "Boolean(document.querySelector('<input-selector>')) && (document.querySelector('<input-selector>')?.innerText || document.querySelector('<input-selector>')?.value || '').trim().length === 0"
actionbook browser html > /tmp/<provider>-idle.html
bun run mock:capture:state --provider <provider> --state idle --input /tmp/<provider>-idle.html
```

### 2) send-ready

在页面中手动输入一段短文本（不要发送），然后执行：

```bash
actionbook browser snapshot
actionbook browser eval "(document.querySelector('<input-selector>')?.innerText || document.querySelector('<input-selector>')?.value || '').trim().length > 0 && !document.querySelector('<submit-selector>')?.hasAttribute('disabled')"
actionbook browser html > /tmp/<provider>-send-ready.html
bun run mock:capture:state --provider <provider> --state send-ready --input /tmp/<provider>-send-ready.html
```

### 3) streaming

先手动点击发送，等待进入流式输出后尽快执行：

```bash
actionbook browser snapshot
actionbook browser eval "Boolean(document.querySelector('<streaming-indicator-selector>'))"
actionbook browser html > /tmp/<provider>-streaming.html
bun run mock:capture:state --provider <provider> --state streaming --input /tmp/<provider>-streaming.html
```

### 4) complete

等待回答完成后执行：

```bash
actionbook browser snapshot
actionbook browser eval "!document.querySelector('<streaming-indicator-selector>') && Boolean(document.querySelector('<complete-indicator-selector>'))"
actionbook browser html > /tmp/<provider>-complete.html
bun run mock:capture:state --provider <provider> --state complete --input /tmp/<provider>-complete.html
```

## 最小端到端示例

示例：抓取 `claude` 的 `idle` 状态，并验证 manifest 已更新。

```bash
actionbook browser open "https://claude.ai/"
actionbook browser snapshot
actionbook browser html > /tmp/claude-idle.html
bun run mock:capture:state --provider claude --state idle --input /tmp/claude-idle.html
cat tests/fixtures/raw/claude/manifest.json
```

预期结果：

- 文件 `tests/fixtures/raw/claude/idle.html` 被写入。
- `tests/fixtures/raw/claude/manifest.json` 包含 `state: "idle"`、`capturedAt`、`sourceFile`。

## 后续处理（生成 simulation）

四状态抓完后，可基于 `complete.html` 继续生成 simulation：

```bash
bun run mock:capture:process --provider <provider> --input tests/fixtures/raw/<provider>/complete.html
```
