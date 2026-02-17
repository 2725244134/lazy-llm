---
name: mock-capture
description: Capture real provider websites and generate mock HTML pages for E2E testing. Use when user asks to update, refresh, or create mock pages for any provider (chatgpt, claude, gemini, grok, perplexity, aistudio).
---

# mock-capture

Capture a live provider chat page and generate a mock simulation HTML for E2E
testing. Replaces the old Playwright-based `mockCapture.ts` by delegating
browser control to actionbook and processing to a pure Node script.

## Supported providers

| Key | URL |
|------|------|
| `chatgpt` | https://chatgpt.com/ |
| `claude` | https://claude.ai/ |
| `gemini` | https://gemini.google.com/ |
| `grok` | https://grok.com/ |
| `perplexity` | https://www.perplexity.ai/ |
| `aistudio` | https://aistudio.google.com/prompts/new_chat |

## Workflow

### Phase 1: Open real website with actionbook

Use the user's already-logged-in browser via actionbook extension or CDP mode.

```bash
# Find selectors for the provider (optional — for later validation)
actionbook search "<provider> chat page"
actionbook get <manual-id>

# Open the provider URL
actionbook browser open "<provider-url>"
```

Wait for the page to fully load. If the user needs to log in, tell them and
wait for confirmation before continuing.

### Phase 2: Capture DOM

```bash
# Grab the full rendered HTML
actionbook browser html > /tmp/<provider>-raw.html
```

Verify the file is non-empty and contains expected elements (e.g. a chat
container or input area).

### Phase 3: Process

Run the pure processing script to clean DOM, inject sentinels, generate
runtime, and write the simulation file:

```bash
bun scripts/lib/mockCaptureProcess.ts --provider <key> --input /tmp/<provider>-raw.html
```

This outputs to `tests/fixtures/mock-site/<key>-simulation.html` and updates
`mock-provider-config.json`.

### Phase 4: Validate (recommended)

Open the generated mock page and verify it works:

```bash
# Open generated file in browser
actionbook browser open "file://$(pwd)/tests/fixtures/mock-site/<key>-simulation.html"

# Take a snapshot to visually verify
actionbook browser snapshot

# Check that the input area and submit button exist
actionbook browser eval "document.querySelector('<input-selector>') !== null"
actionbook browser eval "document.querySelector('<submit-selector>') !== null"
```

Optionally run the E2E test suite to confirm no regressions:

```bash
bun run test:unit
```

### Phase 5: Cleanup

```bash
actionbook browser close
rm /tmp/<provider>-raw.html
```

## Multi-provider capture

To capture all providers in sequence, repeat Phases 1-5 for each key. Between
providers, close the current tab and open the next URL.

## Troubleshooting

- **Login required**: Tell the user to log in manually in their browser, then
  retry the `actionbook browser html` step.
- **Empty HTML**: The page may not have loaded fully. Wait a few seconds and
  retry `actionbook browser html`.
- **Selector mismatch after capture**: The provider may have updated their DOM.
  Check the inject config in `src/providers/<key>/inject.ts` and update
  selectors if needed.
