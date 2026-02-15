---
name: mock-capture-verify
description: End-to-end workflow: crawl real provider DOM + styles, detect drift, regenerate mocks, verify parity.
type: flow
---

# Mock Capture-Verify Workflow

End-to-end pipeline for creating, maintaining, and verifying high-fidelity mock
LLM provider pages used in E2E testing.

## Overview

```
Real site ──crawl──> CrawlSnapshot (DOM + computed styles + CSS vars)
                          │
                     transform
                          │
                          v
               Self-contained mock HTML (real styles + mock interaction runtime)
                          │
                     parity verify
                          v
                   tests/fixtures/mock-site/*.html
```

Two generation paths are available:

- **Option A — Style-aware (high fidelity):** `mockCrawlCli` → `mockTransformCli`
  Requires auth/storage-state for logged-in access. Produces visually faithful mocks.
- **Option B — Template (fast fallback):** `mockGenerateCli`
  Hand-written templates. No auth needed. Guarantees selector parity only.

## Prerequisites

- **Playwright** installed (`bun install`)
- **Auth storage state** (Option A only): saved browser state in JSON format
  (e.g. `auth/chatgpt.json`). Create via `playwright codegen --save-storage`.

## Supported Providers

| Key | Name | Real URL |
|-----|------|----------|
| `chatgpt` | ChatGPT | chatgpt.com |
| `grok` | Grok | grok.com |
| `gemini` | Gemini | gemini.google.com |
| `claude` | Claude | claude.ai |
| `perplexity` | Perplexity | perplexity.ai |
| `aistudio` | AI Studio | aistudio.google.com |

## Workflow Steps

### Step 1 — Crawl (style-aware)

Capture DOM structure + computed styles from the real provider site.

```bash
# Single provider (with auth)
bun run mock:crawl -- --provider chatgpt --storage-state auth/chatgpt.json > /tmp/chatgpt-crawl.json

# Single provider (manual login — opens headed browser)
bun run mock:crawl -- --provider chatgpt > /tmp/chatgpt-crawl.json

# Override region selectors
bun run mock:crawl -- --provider chatgpt --storage-state auth/chatgpt.json \
  --chat-selector 'main [class*="react-scroll-to-bottom"]' \
  --input-selector 'form:has(#prompt-textarea)' > /tmp/chatgpt-crawl.json
```

Outputs `CliOutput<CrawlSnapshot>` JSON with:
- `chatRegionDom` / `inputRegionDom` — styled DOM trees
- `cssVariables` — `:root` CSS custom properties
- `fonts` — font URL references

### Step 2 — Drift Detection

Compare a capture snapshot against the parity manifest to detect selector drift.

```bash
bun run mock:diff -- \
  --capture capture.json \
  --manifest tests/fixtures/mock-site/parity-manifest.json
```

Outputs `CliOutput<DriftReport>` — lists found vs missing selectors.
Non-zero exit if any `required` selectors are missing.

### Step 3a — Transform (style-aware generation)

Convert a crawl snapshot into a self-contained mock HTML page.

```bash
bun run mock:transform -- --provider chatgpt --snapshot /tmp/chatgpt-crawl.json
```

The transform step:
1. Generates `<style>` rules from crawled computed styles
2. Serializes DOM tree to HTML (without inline styles)
3. Injects runtime element IDs (`#chat-history`, `#send-btn`, `#streaming-btn`, etc.)
4. Injects mock interaction runtime (`<script>` block)
5. Writes `<provider>-simulation.html` and updates `mock-provider-config.json`

### Step 3b — Generate (fast fallback)

Generate mock HTML from hand-written templates (no auth needed).

```bash
# Single provider
bun scripts/lib/mockGenerateCli.ts --provider chatgpt

# All providers
bun run mock:generate
```

### Step 4 — Verify Parity

Run DOM parity checks and selector probes.

```bash
bun run mock:parity
```

Checks:
- **DOM parity**: structural selectors exist in mock HTML
- **Selector probes**: input, submit, streaming, complete, extract categories

## Full Pipeline Examples

### Option A — Style-aware (single provider)

```bash
# 1. Crawl
bun run mock:crawl -- --provider chatgpt --storage-state auth/chatgpt.json > /tmp/chatgpt-crawl.json

# 2. Check drift (optional)
bun run mock:diff -- --capture /tmp/chatgpt-capture.json --manifest tests/fixtures/mock-site/parity-manifest.json

# 3. Transform
bun run mock:transform -- --provider chatgpt --snapshot /tmp/chatgpt-crawl.json

# 4. Verify
bun run mock:parity
```

### Option B — Template fallback (all providers)

```bash
# 1. Generate all
bun run mock:generate

# 2. Verify
bun run mock:parity
```

## Decision Guide: Option A vs B

| | Option A (Style-aware) | Option B (Template) |
|---|---|---|
| **Auth required** | Yes | No |
| **Visual fidelity** | High (real styles) | Low (minimal CSS) |
| **Selector parity** | Yes | Yes |
| **When to use** | Updating mocks after real site changes | Quick iteration, CI, no-auth environments |
| **Maintenance** | Re-crawl when site changes | Manual template updates |

## Files

| Path | Purpose |
|------|---------|
| `scripts/lib/mockTypes.ts` | Shared TypeScript types (CrawlSnapshot, StyledDomNode, etc.) |
| `scripts/lib/mockProfiles.ts` | Built-in provider profiles with region selectors |
| `scripts/lib/mockRuntime.ts` | Shared mock interaction runtime |
| `scripts/lib/mockCrawlCli.ts` | Step 1: Style-aware DOM crawl CLI |
| `scripts/lib/mockTransformCli.ts` | Step 3a: Crawl snapshot → mock HTML transform |
| `scripts/lib/mockGenerateCli.ts` | Step 3b: Hand-written template generator |
| `scripts/lib/mockGenerateAll.ts` | Step 3b: Batch generation for all providers |
| `scripts/lib/mockDiffCli.ts` | Step 2: Drift detection CLI |
| `scripts/lib/mockParityCli.ts` | Step 4: Parity verification CLI |
| `scripts/lib/mockCaptureCli.ts` | DOM capture CLI (used by diff step) |
| `tests/fixtures/mock-site/` | Generated mock HTML + config + manifest |
