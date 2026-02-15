#!/usr/bin/env bun
/**
 * mockDiffCli.ts
 *
 * Drift detection tool that compares a capture snapshot's normalizedDom
 * against the parity manifest to detect selector drift on real provider sites.
 *
 * Usage:
 *   bun scripts/lib/mockDiffCli.ts \
 *     --capture capture.json \
 *     --manifest tests/fixtures/mock-site/parity-manifest.json
 *
 * Output: JSON CliOutput<DriftReport> to stdout.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  CaptureSnapshot,
  CliOutput,
  DriftReport,
  NormalizedDomNode,
  ParityManifestEntry,
  SelectorDriftEntry,
} from './mockTypes';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { capture: string; manifest: string } {
  const args = process.argv.slice(2);
  let capture = '';
  let manifest = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--capture' && args[i + 1]) {
      capture = args[++i];
    } else if (args[i] === '--manifest' && args[i + 1]) {
      manifest = args[++i];
    }
  }

  return { capture, manifest };
}

function output<T>(result: CliOutput<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Simplified CSS selector parser
// ---------------------------------------------------------------------------

interface SelectorSegment {
  tag?: string;
  id?: string;
  classes: string[];
  attrs: AttrMatcher[];
}

interface AttrMatcher {
  name: string;
  op: '=' | '*=' | '^=' | null;
  value?: string;
}

/**
 * Parse a single simple selector (no combinators) into its parts.
 * Supports: tag, #id, .class, [attr], [attr='value'], [attr*='value'], [attr^='value']
 */
function parseSimpleSelector(raw: string): SelectorSegment {
  const seg: SelectorSegment = { classes: [], attrs: [] };
  let i = 0;

  // Tag name
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
    } else if (raw[i] === '.') {
      i++;
      let cls = '';
      while (i < raw.length && /[a-zA-Z0-9\-_\\:]/.test(raw[i])) {
        cls += raw[i++];
      }
      // Handle escaped chars like dark\:prose-invert -> dark:prose-invert
      seg.classes.push(cls.replace(/\\/g, ''));
    } else if (raw[i] === '[') {
      i++;
      let name = '';
      while (i < raw.length && raw[i] !== ']' && raw[i] !== '=' && raw[i] !== '*' && raw[i] !== '^') {
        name += raw[i++];
      }
      if (i < raw.length && raw[i] === ']') {
        // [attr] — presence check
        i++;
        seg.attrs.push({ name, op: null });
      } else {
        let op: AttrMatcher['op'] = '=';
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
        // Read value — may be quoted with ' or "
        let value = '';
        const quote = raw[i] === "'" || raw[i] === '"' ? raw[i] : null;
        if (quote) i++;
        while (i < raw.length && raw[i] !== (quote ?? ']')) {
          value += raw[i++];
        }
        if (quote && i < raw.length) i++; // skip closing quote
        if (i < raw.length && raw[i] === ']') i++; // skip ]
        seg.attrs.push({ name, op, value });
      }
    } else {
      i++; // skip unexpected chars
    }
  }

  return seg;
}

/**
 * Parse a full CSS selector into a list of descendant-combined segments.
 * Only supports the descendant combinator (space).
 * Pseudo-classes are stripped (treated as matched).
 */
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

function parseSelector(selector: string): SelectorSegment[] {
  const cleaned = stripUnsupportedPseudoClasses(selector).trim();
  if (!cleaned) return [];
  return splitByDescendantCombinator(cleaned).map(parseSimpleSelector);
}

// ---------------------------------------------------------------------------
// DOM tree matching
// ---------------------------------------------------------------------------

function nodeMatchesSegment(node: NormalizedDomNode, seg: SelectorSegment): boolean {
  if (seg.tag && node.tag !== seg.tag) return false;
  if (seg.id && node.attrs.id !== seg.id) return false;
  for (const cls of seg.classes) {
    const nodeClasses = (node.attrs.class || '').split(/\s+/);
    if (!nodeClasses.includes(cls)) return false;
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

/**
 * Check if a descendant-combinator selector matches anywhere in the DOM tree.
 * Returns true if there exists a path from some ancestor to some descendant
 * that matches all segments in order.
 */
function matchSelectorInTree(
  node: NormalizedDomNode,
  segments: SelectorSegment[],
  segIndex: number,
): boolean {
  if (segIndex >= segments.length) return true;

  if (nodeMatchesSegment(node, segments[segIndex])) {
    // If this is the last segment, we have a full match
    if (segIndex === segments.length - 1) return true;
    // Try to match remaining segments in descendants
    for (const child of node.children) {
      if (matchSelectorInTree(child, segments, segIndex + 1)) return true;
    }
  }

  // Try matching the same segment starting from children (descendant combinator)
  for (const child of node.children) {
    if (matchSelectorInTree(child, segments, segIndex)) return true;
  }

  return false;
}

function selectorExistsInDom(root: NormalizedDomNode, selector: string): boolean {
  const segments = parseSelector(selector);
  if (segments.length === 0) return false;
  return matchSelectorInTree(root, segments, 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { capture, manifest } = parseArgs();

  if (!capture) {
    return output({ success: false, error: 'Missing --capture argument' });
  }
  if (!manifest) {
    return output({ success: false, error: 'Missing --manifest argument' });
  }

  const capturePath = resolve(capture);
  if (!existsSync(capturePath)) {
    return output({ success: false, error: `Capture file not found: ${capturePath}` });
  }

  const manifestPath = resolve(manifest);
  if (!existsSync(manifestPath)) {
    return output({ success: false, error: `Manifest file not found: ${manifestPath}` });
  }

  let snapshot: CaptureSnapshot;
  try {
    const captureData: CliOutput<CaptureSnapshot> = JSON.parse(readFileSync(capturePath, 'utf8'));
    if (!captureData.success || !captureData.data) {
      return output({ success: false, error: 'Capture file does not contain a successful snapshot' });
    }
    snapshot = captureData.data;
  } catch (err) {
    return output({
      success: false,
      error: `Failed to parse capture file: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  let entries: ParityManifestEntry[];
  try {
    entries = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return output({
      success: false,
      error: `Failed to parse manifest: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  const entry = entries.find((e) => e.provider === snapshot.provider);
  if (!entry) {
    return output({
      success: false,
      error: `No manifest entry found for provider: ${snapshot.provider}`,
    });
  }

  const selectorsFound: SelectorDriftEntry[] = [];
  const selectorsMissing: SelectorDriftEntry[] = [];

  // Check structural selectors
  for (const selector of entry.structuralSelectors) {
    const driftEntry: SelectorDriftEntry = {
      selector,
      category: 'structural',
      required: true,
    };
    if (selectorExistsInDom(snapshot.normalizedDom, selector)) {
      selectorsFound.push(driftEntry);
    } else {
      selectorsMissing.push(driftEntry);
    }
  }

  // Check selector probes
  for (const probe of entry.selectorProbes) {
    const driftEntry: SelectorDriftEntry = {
      selector: probe.selector,
      category: probe.category,
      required: probe.required,
    };
    if (selectorExistsInDom(snapshot.normalizedDom, probe.selector)) {
      selectorsFound.push(driftEntry);
    } else {
      selectorsMissing.push(driftEntry);
    }
  }

  const report: DriftReport = {
    provider: snapshot.provider,
    capturedAt: snapshot.capturedAt,
    selectorsFound,
    selectorsMissing,
  };

  const hasRequiredMissing = selectorsMissing.some((s) => s.required);

  return output({
    success: !hasRequiredMissing,
    data: report,
    error: hasRequiredMissing
      ? `${selectorsMissing.filter((s) => s.required).length} required selector(s) missing — DOM drift detected`
      : undefined,
  });
}

main();
