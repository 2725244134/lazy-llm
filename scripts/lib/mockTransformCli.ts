#!/usr/bin/env bun
/**
 * mockTransformCli.ts
 *
 * Transforms a CrawlSnapshot (style-aware DOM capture) into a self-contained
 * mock HTML file with real visual styles + mock interaction runtime.
 *
 * Usage:
 *   bun scripts/lib/mockTransformCli.ts --provider chatgpt --snapshot crawl.json \
 *     [--output-dir tests/fixtures/mock-site]
 *
 * Output: JSON CliOutput with generated file paths to stdout.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join, relative, isAbsolute, sep } from 'path';
import { pathToFileURL } from 'url';
import { MOCK_PROFILES } from './mockProfiles';
import { generateProviderRuntime } from './mockRuntime';
import type {
  CliOutput,
  CrawlSnapshot,
  MockProviderConfigEntry,
  MockProviderConfigFile,
  StyledDomNode,
} from './mockTypes';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface TransformArgs {
  provider: string;
  snapshot: string;
  outputDir: string;
}

function parseArgs(): TransformArgs {
  const args = process.argv.slice(2);
  const result: TransformArgs = {
    provider: '',
    snapshot: '',
    outputDir: 'tests/fixtures/mock-site',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      result.provider = args[++i];
    } else if (args[i] === '--snapshot' && args[i + 1]) {
      result.snapshot = args[++i];
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      result.outputDir = args[++i];
    }
  }

  return result;
}

function output<T>(result: CliOutput<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

function toConfigFileUrl(htmlPath: string): string {
  const cwd = resolve(process.cwd());
  const rel = relative(cwd, htmlPath);
  const insideCwd = rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
  if (insideCwd) {
    return `file://./${rel.split(sep).join('/')}`;
  }
  return pathToFileURL(htmlPath).toString();
}

// ---------------------------------------------------------------------------
// Runtime ID injection map — provider → { selector → id to inject }
// ---------------------------------------------------------------------------

const RUNTIME_ID_MAP: Record<string, Record<string, { id: string; extraAttrs?: Record<string, string> }>> = {
  chatgpt: {
    'div.ProseMirror, div[contenteditable="true"]': { id: 'prompt-textarea' },
    "button[data-testid='send-button'], button[aria-label*='Send']": { id: 'send-btn' },
    "button[aria-label='Stop generating'], button[data-testid='stop-button']": {
      id: 'streaming-btn',
      extraAttrs: { class: 'hidden' },
    },
  },
  grok: {
    'div.ProseMirror[contenteditable="true"], div[contenteditable="true"][role="textbox"]': { id: 'grok-input' },
    "button[type='submit'], button[aria-label*='Submit']": { id: 'send-btn' },
    "button[aria-label='Stop']": { id: 'streaming-btn', extraAttrs: { class: 'hidden' } },
  },
  gemini: {
    '.ql-editor[contenteditable="true"], div.ql-editor': { id: 'gemini-input' },
    "button.send-button, button[aria-label*='Send']": { id: 'send-btn' },
    "button[aria-label='Stop response'], button[aria-label*='Stop']": {
      id: 'streaming-btn',
      extraAttrs: { class: 'hidden' },
    },
  },
  claude: {
    "div[contenteditable='true'][data-placeholder], div.ProseMirror[contenteditable='true']": { id: 'claude-input' },
    "button[aria-label*='Send'], fieldset button": { id: 'send-btn' },
    "button[aria-label*='Stop'], button[data-testid='stop-button']": {
      id: 'streaming-btn',
      extraAttrs: { class: 'hidden' },
    },
  },
  perplexity: {
    "#ask-input, div[data-lexical-editor='true']": { id: 'ask-input' },
    "button[aria-label='Voice mode'], button[aria-label*='Submit']": { id: 'send-btn' },
    "button[aria-label='Stop']": { id: 'streaming-btn', extraAttrs: { class: 'hidden' } },
  },
  aistudio: {
    "textarea[aria-label='Enter a prompt'], textarea": { id: 'aistudio-input' },
    'ms-run-button button, button[type="submit"]': { id: 'send-btn' },
    "button[aria-label='Stop']": { id: 'streaming-btn', extraAttrs: { class: 'hidden' } },
  },
};

// ---------------------------------------------------------------------------
// CSS generation from StyledDomNode tree
// ---------------------------------------------------------------------------

interface CssRule {
  selector: string;
  properties: Record<string, string>;
}

/** Counter for generating unique classes when no identifiable selector exists. */
let autoClassCounter = 0;

function escapeCssIdentifier(value: string): string {
  const nativeEscape = (globalThis as { CSS?: { escape?: (input: string) => string } }).CSS?.escape;
  if (typeof nativeEscape === 'function') {
    return nativeEscape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

/**
 * Generate a CSS selector for a node. Prefers class, then tag[attr], then auto-generated class.
 */
function selectorForNode(node: StyledDomNode): string {
  if (node.attrs.id) {
    return `#${node.attrs.id}`;
  }
  if (node.attrs.class) {
    const classes = node.attrs.class
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => `.${escapeCssIdentifier(c)}`)
      .join('');
    return `${node.tag}${classes}`;
  }
  if (node.attrs.role) {
    return `${node.tag}[role="${node.attrs.role}"]`;
  }
  if (node.attrs['data-testid']) {
    return `${node.tag}[data-testid="${node.attrs['data-testid']}"]`;
  }
  // Auto-generate a class
  const autoClass = `_mc${autoClassCounter++}`;
  node.attrs.class = autoClass;
  return `.${autoClass}`;
}

/**
 * Collect CSS rules from a StyledDomNode tree.
 * Merges rules with identical selector + properties.
 */
function collectCssRules(node: StyledDomNode): CssRule[] {
  const rules: CssRule[] = [];
  const seen = new Map<string, CssRule>();

  function walk(n: StyledDomNode): void {
    const styles = n.computedStyles;
    if (styles && Object.keys(styles).length > 0) {
      const sel = selectorForNode(n);
      const key = sel + '|' + JSON.stringify(styles);
      if (!seen.has(key)) {
        const rule: CssRule = { selector: sel, properties: styles as Record<string, string> };
        seen.set(key, rule);
        rules.push(rule);
      }
    }
    for (const child of n.children) {
      walk(child);
    }
  }

  walk(node);
  return rules;
}

function formatCssRules(rules: CssRule[]): string {
  // De-duplicate: group by selector, merge properties
  const merged = new Map<string, Record<string, string>>();
  for (const rule of rules) {
    const existing = merged.get(rule.selector);
    if (existing) {
      Object.assign(existing, rule.properties);
    } else {
      merged.set(rule.selector, { ...rule.properties });
    }
  }

  const lines: string[] = [];
  for (const [selector, props] of merged) {
    const propLines = Object.entries(props)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    lines.push(`${selector} {\n${propLines}\n}`);
  }
  return lines.join('\n\n');
}

// ---------------------------------------------------------------------------
// HTML serialization from StyledDomNode tree
// ---------------------------------------------------------------------------

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function serializeHtml(node: StyledDomNode, indent: number = 0): string {
  const pad = '  '.repeat(indent);
  const tag = node.tag;

  // Skip STYLE/LINK nodes from crawl (we generate our own styles)
  if (['style', 'link'].includes(tag)) return '';

  // Build attribute string
  const attrParts: string[] = [];
  for (const [k, v] of Object.entries(node.attrs)) {
    attrParts.push(`${k}="${escapeAttr(v)}"`);
  }
  const attrStr = attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';

  if (VOID_ELEMENTS.has(tag)) {
    return `${pad}<${tag}${attrStr}>`;
  }

  if (node.children.length === 0 && node.textContent) {
    return `${pad}<${tag}${attrStr}>${escapeHtml(node.textContent)}</${tag}>`;
  }

  if (node.children.length === 0) {
    return `${pad}<${tag}${attrStr}></${tag}>`;
  }

  const childHtml = node.children
    .map((c) => serializeHtml(c, indent + 1))
    .filter(Boolean)
    .join('\n');
  return `${pad}<${tag}${attrStr}>\n${childHtml}\n${pad}</${tag}>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// ID injection: tag crawled DOM nodes with runtime-required IDs
// ---------------------------------------------------------------------------

/**
 * Try to inject runtime IDs into the DOM tree based on simplified selector matching.
 * Modifies nodes in-place.
 */
function injectRuntimeIds(
  trees: StyledDomNode[],
  provider: string,
): void {
  const idMap = RUNTIME_ID_MAP[provider];
  if (!idMap) return;

  // Also ensure the chat container gets id="chat-history"
  // The chat region root itself is the chat-history
  if (trees[0]) {
    trees[0].attrs.id = 'chat-history';
  }

  for (const [selectorGroup, config] of Object.entries(idMap)) {
    const selectors = selectorGroup.split(',').map((s) => s.trim());
    let found = false;

    for (const sel of selectors) {
      if (found) break;
      for (const tree of trees) {
        const node = findNodeBySelector(tree, sel);
        if (node) {
          node.attrs.id = config.id;
          if (config.extraAttrs) {
            for (const [k, v] of Object.entries(config.extraAttrs)) {
              if (k === 'class' && node.attrs.class) {
                node.attrs.class += ' ' + v;
              } else {
                node.attrs[k] = v;
              }
            }
          }
          found = true;
          break;
        }
      }
    }
  }
}

type AttrOperator = '=' | '*=' | '^=' | null;

interface SelectorAttr {
  name: string;
  op: AttrOperator;
  value?: string;
}

interface SelectorSegment {
  tag?: string;
  id?: string;
  classes: string[];
  attrs: SelectorAttr[];
}

function stripUnsupportedPseudoClasses(selector: string): string {
  let out = '';
  let i = 0;
  let inQuote: "'" | '"' | null = null;
  let bracketDepth = 0;

  while (i < selector.length) {
    const ch = selector[i];
    const escaped = i > 0 && selector[i - 1] === '\\';

    if (inQuote) {
      out += ch;
      if (ch === inQuote && !escaped) {
        inQuote = null;
      }
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      inQuote = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === '[') {
      bracketDepth++;
      out += ch;
      i++;
      continue;
    }

    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      out += ch;
      i++;
      continue;
    }

    if (ch === ':' && !escaped && bracketDepth === 0) {
      i++;
      while (i < selector.length && /[a-zA-Z0-9_-]/.test(selector[i])) i++;
      if (selector[i] === '(') {
        let depth = 1;
        i++;
        let fnQuote: "'" | '"' | null = null;
        while (i < selector.length && depth > 0) {
          const fnCh = selector[i];
          const fnEscaped = i > 0 && selector[i - 1] === '\\';
          if (fnQuote) {
            if (fnCh === fnQuote && !fnEscaped) {
              fnQuote = null;
            }
            i++;
            continue;
          }
          if (fnCh === "'" || fnCh === '"') {
            fnQuote = fnCh;
            i++;
            continue;
          }
          if (fnCh === '(') depth++;
          if (fnCh === ')') depth--;
          i++;
        }
      }
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

function splitByDescendantCombinator(selector: string): string[] {
  const segments: string[] = [];
  let current = '';
  let bracketDepth = 0;
  let parenDepth = 0;
  let inQuote: "'" | '"' | null = null;

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    const escaped = i > 0 && selector[i - 1] === '\\';

    if (inQuote) {
      current += ch;
      if (ch === inQuote && !escaped) {
        inQuote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"') {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === '[') bracketDepth++;
    if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    if (ch === '(') parenDepth++;
    if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);

    if (/\s/.test(ch) && bracketDepth === 0 && parenDepth === 0) {
      if (current.trim().length > 0) {
        segments.push(current.trim());
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.trim().length > 0) {
    segments.push(current.trim());
  }

  return segments;
}

function parseSelectorSegment(raw: string): SelectorSegment {
  const seg: SelectorSegment = { classes: [], attrs: [] };
  let i = 0;

  if (i < raw.length && /[a-zA-Z\-]/.test(raw[i])) {
    let tag = '';
    while (i < raw.length && /[a-zA-Z0-9\-]/.test(raw[i])) {
      tag += raw[i++];
    }
    seg.tag = tag.toLowerCase();
  }

  while (i < raw.length) {
    if (raw[i] === '#') {
      i++;
      let id = '';
      while (i < raw.length && /[a-zA-Z0-9\-_]/.test(raw[i])) {
        id += raw[i++];
      }
      seg.id = id;
      continue;
    }

    if (raw[i] === '.') {
      i++;
      let cls = '';
      while (i < raw.length && /[a-zA-Z0-9\-_\\:]/.test(raw[i])) {
        cls += raw[i++];
      }
      seg.classes.push(cls.replace(/\\/g, ''));
      continue;
    }

    if (raw[i] === '[') {
      i++;
      let name = '';
      while (i < raw.length && raw[i] !== ']' && raw[i] !== '=' && raw[i] !== '*' && raw[i] !== '^') {
        name += raw[i++];
      }

      if (i < raw.length && raw[i] === ']') {
        i++;
        seg.attrs.push({ name, op: null });
        continue;
      }

      let op: AttrOperator = '=';
      if (raw[i] === '*' && raw[i + 1] === '=') {
        op = '*=';
        i += 2;
      } else if (raw[i] === '^' && raw[i + 1] === '=') {
        op = '^=';
        i += 2;
      } else if (raw[i] === '=') {
        op = '=';
        i++;
      }

      let value = '';
      const quote = raw[i] === "'" || raw[i] === '"' ? raw[i] : null;
      if (quote) i++;
      while (i < raw.length && raw[i] !== (quote ?? ']')) {
        value += raw[i++];
      }
      if (quote && i < raw.length) i++;
      if (i < raw.length && raw[i] === ']') i++;
      seg.attrs.push({ name, op, value });
      continue;
    }

    i++;
  }

  return seg;
}

function parseSelector(selector: string): SelectorSegment[] {
  const cleaned = stripUnsupportedPseudoClasses(selector).trim();
  if (!cleaned) return [];
  return splitByDescendantCombinator(cleaned).map(parseSelectorSegment);
}

function nodeMatchesSegment(node: StyledDomNode, seg: SelectorSegment): boolean {
  if (seg.tag && node.tag !== seg.tag) return false;
  if (seg.id && node.attrs.id !== seg.id) return false;

  for (const cls of seg.classes) {
    const classes = (node.attrs.class ?? '').split(/\s+/).filter(Boolean);
    if (!classes.includes(cls)) return false;
  }

  for (const attr of seg.attrs) {
    const val = node.attrs[attr.name];
    if (val === undefined) return false;
    if (attr.op === '=' && attr.value !== undefined && val !== attr.value) return false;
    if (attr.op === '*=' && attr.value !== undefined && !val.includes(attr.value)) return false;
    if (attr.op === '^=' && attr.value !== undefined && !val.startsWith(attr.value)) return false;
  }

  return true;
}

function findNodeBySelector(root: StyledDomNode, selector: string): StyledDomNode | null {
  const segments = parseSelector(selector);
  if (segments.length === 0) return null;

  const targetIndex = segments.length - 1;
  const ancestors: StyledDomNode[] = [];

  function ancestorsMatch(): boolean {
    let segIndex = targetIndex - 1;
    if (segIndex < 0) return true;
    for (let i = ancestors.length - 1; i >= 0 && segIndex >= 0; i--) {
      if (nodeMatchesSegment(ancestors[i], segments[segIndex])) {
        segIndex--;
      }
    }
    return segIndex < 0;
  }

  function walk(node: StyledDomNode): StyledDomNode | null {
    if (nodeMatchesSegment(node, segments[targetIndex]) && ancestorsMatch()) {
      return node;
    }

    ancestors.push(node);
    for (const child of node.children) {
      const found = walk(child);
      if (found) {
        ancestors.pop();
        return found;
      }
    }
    ancestors.pop();
    return null;
  }

  return walk(root);
}

// ---------------------------------------------------------------------------
// Grok form wrapper: ensure the form#chat-form exists for the runtime
// ---------------------------------------------------------------------------

function ensureGrokForm(inputRegion: StyledDomNode): void {
  // The grok runtime expects a form#chat-form wrapping the input
  if (inputRegion.tag !== 'form') {
    inputRegion.attrs.id = inputRegion.attrs.id ?? 'chat-form';
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { provider, snapshot, outputDir } = parseArgs();

  if (!provider) {
    return output({ success: false, error: 'Missing --provider argument' });
  }
  if (!snapshot) {
    return output({ success: false, error: 'Missing --snapshot argument' });
  }

  const profile = MOCK_PROFILES[provider];
  if (!profile) {
    return output({
      success: false,
      error: `Unknown provider: ${provider}. Supported: ${Object.keys(MOCK_PROFILES).join(', ')}`,
    });
  }

  const snapshotPath = resolve(snapshot);
  if (!existsSync(snapshotPath)) {
    return output({ success: false, error: `Snapshot file not found: ${snapshotPath}` });
  }

  let crawl: CrawlSnapshot;
  try {
    const raw = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    // Accept both raw CrawlSnapshot and CliOutput<CrawlSnapshot>
    crawl = raw.data ? raw.data : raw;
  } catch (err) {
    return output({
      success: false,
      error: `Failed to parse snapshot: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Reset auto class counter
  autoClassCounter = 0;

  // Inject runtime IDs into the DOM trees
  const chatDom = crawl.chatRegionDom;
  const inputDom = crawl.inputRegionDom;
  injectRuntimeIds([chatDom, inputDom], provider);

  // Grok-specific: ensure form wrapper
  if (provider === 'grok') {
    ensureGrokForm(inputDom);
  }

  // Collect CSS rules from both regions
  const chatRules = collectCssRules(chatDom);
  const inputRules = collectCssRules(inputDom);
  const allRules = [...chatRules, ...inputRules];

  // Build CSS variables block
  const cssVarLines = Object.entries(crawl.cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const cssVarsBlock = cssVarLines ? `:root {\n${cssVarLines}\n}` : '';

  // Build font imports
  const fontImports = crawl.fonts
    .map((url) => `@import url("${url}");`)
    .join('\n');

  // Build full CSS
  const cssContent = [fontImports, cssVarsBlock, formatCssRules(allRules)]
    .filter(Boolean)
    .join('\n\n');

  // Build HTML body
  const chatHtml = serializeHtml(chatDom, 1);
  const inputHtml = serializeHtml(inputDom, 1);

  // Generate runtime script
  const runtimeScript = generateProviderRuntime(provider);

  // Assemble full HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock ${profile.name} Simulation</title>
  <style>
    /* Crawled styles — auto-generated by mockTransformCli.ts */
    body { margin: 0; display: flex; flex-direction: column; height: 100vh; }
    .hidden { display: none !important; }
${cssContent.split('\n').map((l) => '    ' + l).join('\n')}
  </style>
</head>
<body>
${chatHtml}
${inputHtml}
  <script>
${runtimeScript}
  </script>
</body>
</html>`;

  // Write output
  const resolvedDir = resolve(outputDir);
  if (!existsSync(resolvedDir)) {
    mkdirSync(resolvedDir, { recursive: true });
  }

  const htmlFilename = `${provider}-simulation.html`;
  const htmlPath = join(resolvedDir, htmlFilename);
  writeFileSync(htmlPath, html);

  // Update mock-provider-config.json
  const configPath = join(resolvedDir, 'mock-provider-config.json');
  let existingConfig: MockProviderConfigFile = {};
  if (existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      // Start fresh if corrupted
    }
  }

  const entry: MockProviderConfigEntry = {
    url: toConfigFileUrl(htmlPath),
    urlPattern: htmlFilename,
  };

  existingConfig[provider] = entry;
  writeFileSync(configPath, JSON.stringify(existingConfig, null, 2) + '\n');

  return output({
    success: true,
    data: {
      htmlPath,
      configPath,
      mockKey: provider,
    },
  });
}

main();
