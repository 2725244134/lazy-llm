---
name: mock-capture-verify
description: Unified mock maintenance workflow with actionbook-driven browser control and CLI verification.
type: flow
---

# Mock Capture Verify (Unified Skill)

Single entry skill for creating, validating, and maintaining provider mock pages.
This skill replaces legacy split workflows and standardizes browser interaction on
`$actionbook`.

## Hard Rule: Browser Control via `$actionbook`

When interacting with real provider websites, always use `$actionbook`:

1. `actionbook search "<task>"`
2. `actionbook get "<area_id>"`
3. Then run `actionbook browser ...` commands with selectors from the manual
4. If no manual or selector fails, use `actionbook browser snapshot` fallback

Do not perform ad-hoc website interaction outside `$actionbook` in this skill.

## Supported Providers

- `chatgpt`
- `grok`
- `gemini`
- `claude`
- `perplexity`
- `aistudio`

## Workflow A: Fast Template Path (default)

Use for CI and quick iteration when high visual fidelity is not required.

```bash
bun run mock:generate
bun run mock:parity
```

Pass condition:
- `mock:generate` returns `success: true`
- `mock:parity` returns `success: true`

## Workflow B: Live-Site Validation Path (actionbook + capture/crawl/transform)

Use when real provider DOM likely changed.

### Step 1: Inspect the real page with `$actionbook`

```bash
actionbook search "chatgpt chat input page"
actionbook get "<area_id>"
actionbook browser restart
actionbook browser open "https://chatgpt.com/"
actionbook browser snapshot
```

Then use actionbook selectors/snapshot to verify current UI structure before capture.

### Step 2: Capture normalized DOM (for drift check)

```bash
bun run mock:capture -- --provider chatgpt --storage-state auth/chatgpt.json > /tmp/chatgpt-capture.json
```

### Step 3: Drift check (capture -> diff)

```bash
bun run mock:diff -- --capture /tmp/chatgpt-capture.json --manifest tests/fixtures/mock-site/parity-manifest.json
```

### Step 4: Crawl styled regions (for transform)

```bash
bun run mock:crawl -- --provider chatgpt --storage-state auth/chatgpt.json \
  --chat-selector 'main [class*="react-scroll-to-bottom"]' \
  --input-selector 'form:has(#prompt-textarea)' > /tmp/chatgpt-crawl.json
```

If the selectors above fail, use actionbook snapshot output and re-run with explicit overrides.
If crawl output has `success: false`, stop here and fix auth/selectors first.

### Step 5: Transform (crawl -> mock HTML)

```bash
bun run mock:transform -- --provider chatgpt --snapshot /tmp/chatgpt-crawl.json
```

`mock:transform` expects a valid successful `CrawlSnapshot`. Do not pass failed crawl
envelopes (`{ "success": false, ... }`) into transform.

### Step 6: Final verification

```bash
bun run mock:parity
```

### Step 7: Cleanup

```bash
actionbook browser close
```

## Decision Guide

- Choose **Workflow A** when speed and selector-contract validation are enough
- Choose **Workflow B** when real sites changed and mock fidelity needs refresh

## Key Files

- `scripts/lib/mockCrawlCli.ts`
- `scripts/lib/mockCaptureCli.ts`
- `scripts/lib/mockDiffCli.ts`
- `scripts/lib/mockTransformCli.ts`
- `scripts/lib/mockGenerateCli.ts`
- `scripts/lib/mockGenerateAll.ts`
- `scripts/lib/mockParityCli.ts`
- `scripts/lib/mockRuntime.ts`
- `scripts/lib/mockProfiles.ts`
- `tests/fixtures/mock-site/`
