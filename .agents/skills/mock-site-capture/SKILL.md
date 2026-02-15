# Mock Site Capture & Verification Skill

## Purpose

Orchestrates the four-step pipeline for creating, maintaining, and verifying
mock LLM provider pages used in E2E testing. The mocks replicate the DOM
contract (selectors + interaction flow) of real provider sites so that the
`__llmBridge` inject runtime can be tested without hitting live services.

## Supported Providers

- `chatgpt` (ChatGPT — chatgpt.com)
- `grok` (Grok — grok.com)
- `gemini` (Gemini — gemini.google.com)
- `claude` (Claude — claude.ai)
- `perplexity` (Perplexity — perplexity.ai)
- `aistudio` (AI Studio — aistudio.google.com)

## Four-Step Flow

### Step 1 — Capture

Capture a DOM snapshot from the real provider site.

```bash
bun scripts/lib/mockCaptureCli.ts --provider <key> [--storage-state <path>]
```

- With `--storage-state`: uses saved browser state for authenticated access.
- Without: opens a headed browser for manual login.
- Outputs `CaptureSnapshot` JSON (raw HTML + normalized DOM tree).

### Step 1.5 — Drift Check

Compare a capture snapshot against the parity manifest to detect selector drift.

```bash
bun scripts/lib/mockDiffCli.ts \
  --capture capture.json \
  --manifest tests/fixtures/mock-site/parity-manifest.json
```

- Reads the `CaptureSnapshot` JSON (with `normalizedDom` tree).
- Reads the parity manifest entry for the matching provider.
- Performs simplified CSS selector matching against the normalized DOM tree.
- Outputs `CliOutput<DriftReport>` — marks selectors as found or missing.
- If any `required` selectors are missing, the exit code is non-zero.

### Step 2 — Normalize

Normalization happens inside the capture step automatically:
- Strips volatile attributes (inline styles, React internals).
- Removes `<script>`, `<style>`, `<link>`, `<meta>`, `<noscript>`, `<svg>`.
- Preserves structural selectors and `data-testid` / `data-message-author-role`.
- Truncates leaf text content to 200 chars.

### Step 3 — Generate

Generate an interactive mock HTML page and provider config entry.

```bash
bun scripts/lib/mockGenerateCli.ts --provider <key> [--output-dir tests/fixtures/mock-site]
```

- Creates `<provider>-simulation.html` with unified mock runtime
  (input capture, streaming simulation, completion signal).
- Creates/updates `mock-provider-config.json` with the mock provider entry.
- The mock key uses the real provider key (e.g. `chatgpt`) so it **replaces**
  the real provider URL at runtime, ensuring no real sites are loaded.

### Step 4 — Verify

Run DOM parity checks and selector probes against the parity manifest.

```bash
bun scripts/lib/mockParityCli.ts \
  --manifest tests/fixtures/mock-site/parity-manifest.json \
  --mock-dir tests/fixtures/mock-site
```

- **DOM parity**: verifies structural selectors exist in mock HTML.
- **Selector probes**: tests input, submit, streaming, complete, and extract
  selector categories.
- Outputs `ParityResult[]` JSON with pass/fail per provider.

## Parity Manifest Schema

```json
[
  {
    "provider": "chatgpt",
    "structuralSelectors": [
      "#prompt-textarea",
      "#send-btn",
      ".message-row.assistant .content"
    ],
    "selectorProbes": [
      { "category": "input", "selector": "#prompt-textarea", "required": true },
      { "category": "submit", "selector": "#send-btn", "required": true },
      { "category": "streaming", "selector": ".result-streaming", "required": false },
      { "category": "extract", "selector": ".message-row.assistant .content", "required": true }
    ]
  }
]
```

## Verification Criteria

The mock is considered **valid** when:

1. **DOM parity** — all `structuralSelectors` resolve in the mock HTML.
2. **Selector probes** — all `required: true` probes pass.

This does NOT mean full visual or behavioral fidelity with the real site.
It means the `__llmBridge` inject system can exercise its complete contract:
input → submit → streaming detection → completion detection → response extraction.

## Files

| Path | Purpose |
|------|---------|
| `scripts/lib/mockTypes.ts` | Shared TypeScript types |
| `scripts/lib/mockProfiles.ts` | Built-in provider profiles |
| `scripts/lib/mockCaptureCli.ts` | Step 1: DOM capture CLI |
| `scripts/lib/mockDiffCli.ts` | Step 1.5: Drift detection CLI |
| `scripts/lib/mockGenerateCli.ts` | Step 3: Mock generation CLI |
| `scripts/lib/mockGenerateAll.ts` | Step 3: Batch generation for all providers |
| `scripts/lib/mockParityCli.ts` | Step 4: Parity verification CLI |
| `tests/fixtures/mock-site/` | Generated mock HTML + config + manifest |
