#!/usr/bin/env bun
/**
 * Mock Capture Process — strict DOM processing pipeline.
 * Accepts raw HTML and generates a simulation page plus a capture report.
 *
 * Usage:
 *   bun scripts/lib/mockCaptureProcess.ts --provider chatgpt --input /tmp/chatgpt-raw.html
 *   cat /tmp/chatgpt-raw.html | bun scripts/lib/mockCaptureProcess.ts --provider chatgpt
 */

import { resolve, dirname } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { inject as chatgptInject } from '../../src/providers/chatgpt/inject';
import { inject as claudeInject } from '../../src/providers/claude/inject';
import { inject as geminiInject } from '../../src/providers/gemini/inject';
import { inject as grokInject } from '../../src/providers/grok/inject';
import { inject as perplexityInject } from '../../src/providers/perplexity/inject';
import { inject as aistudioInject } from '../../src/providers/aistudio/inject';
import type { ProviderInject } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProviderKey = 'chatgpt' | 'claude' | 'gemini' | 'grok' | 'perplexity' | 'aistudio';

type SelectorField =
  | 'inputSelectors'
  | 'submitSelectors'
  | 'responseSelectors'
  | 'completeIndicatorSelectors';

type SelectorGroup = 'input' | 'submit' | 'response' | 'complete';

type GroupStatus = 'pass' | 'fail';

interface ElementSpec {
  tag: string;
  attrs?: Record<string, string>;
  className?: string;
}

interface ContentWrapSpec {
  tag: string;
  className?: string;
  /** If true, wrap user messages too (not just assistant). Defaults to false. */
  includeUser?: boolean;
}

interface MessageTemplate {
  userWrapper: ElementSpec;
  userContent: ElementSpec;
  assistantWrapper: ElementSpec;
  assistantContent: ElementSpec;
  /** Intermediate wrapper between assistant element and content (e.g. 'message-content' for Gemini). */
  contentWrap?: ContentWrapSpec;
  streamingButton: { attrs: Record<string, string>; text: string };
  completionButtons: Array<{ tag?: string; attrs: Record<string, string>; text: string }>;
  completionWrapper: ElementSpec;
  inputType: 'contenteditable' | 'textarea';
  useForm?: boolean;
  useResponseCounter?: boolean;
}

export interface ProviderConfig {
  url: string;
  displayName: string;
  inject: ProviderInject;
  template: MessageTemplate;
}

interface SelectorProbe {
  selector: string;
  normalizedSelector: string;
  matches: number;
  error?: string;
}

interface SelectorGroupReport {
  field: SelectorField;
  configured: string[];
  matched: string[];
  unmatched: string[];
  probes: SelectorProbe[];
}

interface SelectorAnalysis {
  input: SelectorGroupReport;
  submit: SelectorGroupReport;
  response: SelectorGroupReport;
  complete: SelectorGroupReport;
}

interface CaptureReport {
  provider: ProviderKey;
  timestamp: string;
  strict: boolean;
  rawFile: string;
  simulationFile: string;
  status: 'pass' | 'fail';
  summary: Record<SelectorGroup, GroupStatus>;
  selectors: SelectorAnalysis;
  recommendations: string[];
}

interface ProcessOptions {
  strict: boolean;
  inputPath: string;
  outputPath: string;
  artifactsDir: string;
  writeReport: boolean;
}

interface SelectorGroupConfig {
  key: SelectorGroup;
  field: SelectorField;
  requiredInStrict: boolean;
}

interface HtmlRewriterLike {
  on(
    selector: string,
    handlers: {
      element?: (element: unknown) => void;
      comments?: (comment: unknown) => void;
      text?: (text: unknown) => void;
      end?: (end: unknown) => void;
    }
  ): HtmlRewriterLike;
  transform(response: Response): Response;
}

type HtmlRewriterCtor = new () => HtmlRewriterLike;

// ---------------------------------------------------------------------------
// Provider metadata map
// ---------------------------------------------------------------------------

export const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  chatgpt: {
    url: 'https://chatgpt.com/',
    displayName: 'ChatGPT',
    inject: chatgptInject,
    template: {
      userWrapper: { tag: 'div', attrs: { 'data-message-author-role': 'user' } },
      userContent: { tag: 'div', className: 'markdown' },
      assistantWrapper: { tag: 'div', attrs: { 'data-message-author-role': 'assistant' } },
      assistantContent: { tag: 'div', className: 'markdown' },
      streamingButton: { attrs: { 'aria-label': 'Stop generating', 'data-testid': 'stop-button' }, text: 'Stop generating' },
      completionButtons: [
        { attrs: { 'data-testid': 'copy-turn-action-button' }, text: 'Copy' },
        { attrs: { 'aria-label': 'Good response' }, text: 'Like' },
        { attrs: { 'aria-label': 'Bad response' }, text: 'Dislike' },
      ],
      completionWrapper: { tag: 'div', className: 'action-bar' },
      inputType: 'contenteditable',
    },
  },
  claude: {
    url: 'https://claude.ai/',
    displayName: 'Claude',
    inject: claudeInject,
    template: {
      userWrapper: { tag: 'div', className: 'message-row user' },
      userContent: { tag: 'div', className: 'prose' },
      assistantWrapper: { tag: 'div', attrs: { 'data-turn-role': 'assistant' }, className: 'message-row assistant' },
      assistantContent: { tag: 'div', className: 'font-claude-message' },
      streamingButton: { attrs: { 'aria-label': 'Stop response', 'data-testid': 'stop-button' }, text: 'Stop' },
      completionButtons: [
        { attrs: { 'aria-label': 'Copy' }, text: 'Copy' },
        { attrs: { 'aria-label': 'Retry' }, text: 'Retry' },
        { attrs: { 'aria-label': 'Good response' }, text: 'Like' },
      ],
      completionWrapper: { tag: 'div', className: 'action-bar' },
      inputType: 'contenteditable',
    },
  },
  gemini: {
    url: 'https://gemini.google.com/',
    displayName: 'Gemini',
    inject: geminiInject,
    template: {
      userWrapper: { tag: 'div', className: 'user-query' },
      userContent: { tag: 'div', className: 'user-text' },
      assistantWrapper: { tag: 'model-response' },
      assistantContent: { tag: 'div', className: 'markdown markdown-main-panel' },
      contentWrap: { tag: 'message-content' },
      streamingButton: { attrs: { 'aria-label': 'Stop response' }, text: 'Stop' },
      completionButtons: [
        { attrs: { 'aria-label': 'Copy' }, text: 'Copy' },
        { attrs: { 'aria-label': 'Double-check response' }, text: 'Double-check' },
      ],
      completionWrapper: { tag: 'message-actions' },
      inputType: 'contenteditable',
    },
  },
  grok: {
    url: 'https://grok.com/',
    displayName: 'Grok',
    inject: grokInject,
    template: {
      userWrapper: { tag: 'div', className: 'message-bubble user-msg' },
      userContent: { tag: 'div', className: 'user-text' },
      assistantWrapper: { tag: 'div', className: 'message-bubble assistant-msg' },
      assistantContent: { tag: 'div', className: 'response-content-markdown markdown' },
      streamingButton: { attrs: { 'aria-label': 'Stop' }, text: 'Stop' },
      completionButtons: [
        { attrs: { 'aria-label': 'Regenerate' }, text: 'Regenerate' },
        { attrs: { 'aria-label': 'Copy' }, text: 'Copy' },
        { attrs: { 'aria-label': 'Read Aloud' }, text: 'Read Aloud' },
      ],
      completionWrapper: { tag: 'div', className: 'action-bar' },
      inputType: 'contenteditable',
      useForm: true,
    },
  },
  perplexity: {
    url: 'https://www.perplexity.ai/',
    displayName: 'Perplexity',
    inject: perplexityInject,
    template: {
      userWrapper: { tag: 'div', className: 'query-row' },
      userContent: { tag: 'div', className: 'query-text' },
      assistantWrapper: { tag: 'div', className: 'answer-row' },
      assistantContent: { tag: 'div', className: 'prose' },
      streamingButton: { attrs: { 'aria-label': 'Stop' }, text: 'Stop' },
      completionButtons: [
        { attrs: { 'aria-label': 'Copy' }, text: 'Copy' },
        { attrs: { 'aria-label': 'Share' }, text: 'Share' },
        { attrs: { 'aria-label': 'Rewrite' }, text: 'Rewrite' },
      ],
      completionWrapper: { tag: 'div', className: 'action-bar' },
      inputType: 'contenteditable',
      useResponseCounter: true,
    },
  },
  aistudio: {
    url: 'https://aistudio.google.com/prompts/new_chat',
    displayName: 'AI Studio',
    inject: aistudioInject,
    template: {
      userWrapper: { tag: 'ms-chat-turn', className: 'user-turn' },
      userContent: { tag: 'div', className: 'user-chunk' },
      assistantWrapper: { tag: 'ms-chat-turn', className: 'model-turn' },
      assistantContent: { tag: 'ms-cmark-node', className: 'cmark-node' },
      contentWrap: { tag: 'div', className: 'turn-content', includeUser: true },
      streamingButton: { attrs: { 'aria-label': 'Stop' }, text: 'Stop' },
      completionButtons: [
        { tag: 'button', attrs: { 'aria-label': 'Copy' }, text: 'Copy' },
        { tag: 'button', attrs: { 'aria-label': 'Good response' }, text: 'Good' },
        { tag: 'button', attrs: { 'aria-label': 'Bad response' }, text: 'Bad' },
      ],
      completionWrapper: { tag: 'ms-chat-turn-options' },
      inputType: 'textarea',
    },
  },
};

export const PROVIDER_KEYS = Object.keys(PROVIDERS) as ProviderKey[];

const SELECTOR_GROUPS: SelectorGroupConfig[] = [
  { key: 'input', field: 'inputSelectors', requiredInStrict: true },
  { key: 'submit', field: 'submitSelectors', requiredInStrict: true },
  { key: 'response', field: 'responseSelectors', requiredInStrict: false },
  { key: 'complete', field: 'completeIndicatorSelectors', requiredInStrict: false },
];

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const MOCK_SITE_DIR = resolve(ROOT, 'tests/fixtures/mock-site');
const MOCK_CONFIG_PATH = resolve(MOCK_SITE_DIR, 'mock-provider-config.json');
const DEFAULT_ARTIFACTS_DIR = resolve(MOCK_SITE_DIR, 'artifacts');

// ---------------------------------------------------------------------------
// Codegen helpers — generate JS source fragments for the runtime script
// ---------------------------------------------------------------------------

function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
}

function setAttrsCode(varName: string, attrs: Record<string, string>, indent = '      '): string {
  return Object.entries(attrs).map(([k, v]) => `${indent}${varName}.setAttribute('${k}', '${v}');`).join('\n');
}

function setClassCode(varName: string, className: string | undefined, indent = '      '): string {
  if (!className) return '';
  return `${indent}${varName}.className = '${className}';`;
}

function wrapDeclCode(wrap: ContentWrapSpec, varName: string, indent = '      '): string {
  let line = `${indent}const ${varName} = document.createElement('${wrap.tag}');`;
  if (wrap.className) line += ` ${varName}.className = '${wrap.className}';`;
  return line;
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSelectorForProbe(selector: string): string {
  return selector
    .replace(/:last-of-type/g, '')
    .replace(/:first-of-type/g, '')
    .replace(/:nth-of-type\([^)]*\)/g, '')
    .replace(/:nth-child\([^)]*\)/g, '')
    .replace(/:has\([^)]*\)/g, '')
    .replace(/:is\(([^)]*)\)/g, '$1')
    .replace(/:where\(([^)]*)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProbeToken(selector: string): string | null {
  const idMatch = selector.match(/#([A-Za-z0-9_-]+)/);
  if (idMatch) {
    return `id=\"${idMatch[1]}\"`;
  }

  const dataTestIdContains = selector.match(/\[data-testid\*=['\"]([^'\"]+)['\"]\]/);
  if (dataTestIdContains) {
    return dataTestIdContains[1];
  }

  const attrExact = selector.match(/\[([A-Za-z0-9_-]+)=['\"]([^'\"]+)['\"]\]/);
  if (attrExact) {
    return `${attrExact[1]}=\"${attrExact[2]}\"`;
  }

  const attrContains = selector.match(/\[([A-Za-z0-9_-]+)\*=['\"]([^'\"]+)['\"]\]/);
  if (attrContains) {
    return attrContains[2];
  }

  const classMatch = selector.match(/\.([A-Za-z0-9_-]+)/);
  if (classMatch) {
    return classMatch[1];
  }

  const tagMatch = selector.match(/^([A-Za-z][A-Za-z0-9-]*)/);
  if (tagMatch) {
    return `<${tagMatch[1]}`;
  }

  return null;
}

function countMatchesWithFallback(html: string, selector: string): number {
  const token = extractProbeToken(selector);
  if (!token) {
    return 0;
  }

  const regexp = new RegExp(escapeRegExp(token), 'g');
  return html.match(regexp)?.length ?? 0;
}

function getHtmlRewriterCtor(): HtmlRewriterCtor | null {
  const maybeCtor = (globalThis as unknown as { HTMLRewriter?: HtmlRewriterCtor }).HTMLRewriter;
  if (!maybeCtor) {
    return null;
  }
  return maybeCtor;
}

async function countSelectorMatches(rawHtml: string, selector: string): Promise<{ matches: number; error?: string }> {
  const ctor = getHtmlRewriterCtor();
  if (!ctor) {
    return { matches: countMatchesWithFallback(rawHtml, selector) };
  }

  let matches = 0;
  try {
    const rewriter = new ctor().on(selector, {
      element() {
        matches += 1;
      },
    });
    await rewriter.transform(new Response(rawHtml)).text();
    return { matches };
  } catch (error) {
    return {
      matches: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function analyzeSelectorGroup(rawHtml: string, selectors: string[], field: SelectorField): Promise<SelectorGroupReport> {
  const probes: SelectorProbe[] = [];

  for (const selector of selectors) {
    const normalizedSelector = normalizeSelectorForProbe(selector);
    const result = await countSelectorMatches(rawHtml, normalizedSelector);

    probes.push({
      selector,
      normalizedSelector,
      matches: result.matches,
      error: result.error,
    });
  }

  const matched = probes.filter((probe) => probe.matches > 0).map((probe) => probe.selector);
  const unmatched = probes.filter((probe) => probe.matches === 0).map((probe) => probe.selector);

  return {
    field,
    configured: selectors,
    matched,
    unmatched,
    probes,
  };
}

export async function analyzeSelectors(rawHtml: string, config: ProviderConfig): Promise<SelectorAnalysis> {
  const input = await analyzeSelectorGroup(rawHtml, config.inject.inputSelectors ?? [], 'inputSelectors');
  const submit = await analyzeSelectorGroup(rawHtml, config.inject.submitSelectors ?? [], 'submitSelectors');
  const response = await analyzeSelectorGroup(rawHtml, config.inject.responseSelectors ?? [], 'responseSelectors');
  const complete = await analyzeSelectorGroup(rawHtml, config.inject.completeIndicatorSelectors ?? [], 'completeIndicatorSelectors');

  return { input, submit, response, complete };
}

function groupStatusFromReport(report: SelectorGroupReport): GroupStatus {
  return report.matched.length > 0 ? 'pass' : 'fail';
}

function buildRecommendations(key: ProviderKey, analysis: SelectorAnalysis): string[] {
  const providerFile = `src/providers/${key}/inject.ts`;
  const recommendations: string[] = [];

  for (const group of SELECTOR_GROUPS) {
    const groupReport = analysis[group.key];

    if (group.requiredInStrict && groupReport.matched.length === 0) {
      recommendations.push(
        `${providerFile}: update ${group.field}; none of the configured selectors match current raw HTML.`
      );
      continue;
    }

    const firstProbe = groupReport.probes[0];
    if (!firstProbe) {
      continue;
    }

    if (firstProbe.matches === 0 && groupReport.matched.length > 0) {
      recommendations.push(
        `${providerFile}: consider promoting a matched selector to ${group.field}[0] because current primary selector is stale.`
      );
    }
  }

  return recommendations;
}

function isStrictFailure(summary: Record<SelectorGroup, GroupStatus>, strict: boolean): boolean {
  if (!strict) {
    return false;
  }
  return summary.input === 'fail' || summary.submit === 'fail';
}

export function writeCaptureReport(report: CaptureReport, artifactsDir: string): string {
  mkdirSync(artifactsDir, { recursive: true });
  const reportPath = resolve(artifactsDir, `${report.provider}-capture-report.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return reportPath;
}

// ---------------------------------------------------------------------------
// DOM cleanup — applied to captured HTML
// ---------------------------------------------------------------------------

export function cleanDom(html: string): string {
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  html = html.replace(/<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/gi, '');
  html = html.replace(/<link\s+[^>]*rel\s*=\s*["'](preload|prefetch|preconnect|modulepreload|dns-prefetch)["'][^>]*\/?>/gi, '');
  // Prevent form elements from triggering page navigation on submit.
  html = html.replace(/<form\b/gi, '<form onsubmit="return false"');
  return html;
}

// ---------------------------------------------------------------------------
// Sentinel injection — add hidden streaming indicator if not present
// ---------------------------------------------------------------------------

export function injectSentinels(html: string, config: ProviderConfig): string {
  const { streamingButton } = config.template;
  if (html.includes('id="mock-streaming-btn"')) {
    return html;
  }
  const sentinelAttrs = {
    ...streamingButton.attrs,
    id: 'mock-streaming-btn',
  };
  const sentinel = `<button ${attrsToString(sentinelAttrs)} class="hidden" hidden>${streamingButton.text}</button>`;
  return html.replace(/<\/body>/i, `${sentinel}\n</body>`);
}

// ---------------------------------------------------------------------------
// Runtime script generation
// ---------------------------------------------------------------------------

export function generateRuntime(config: ProviderConfig): string {
  const { template: t, displayName } = config;
  const mockResponse = `This is a streamed response from mock ${displayName}. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.`;

  const isTextarea = t.inputType === 'textarea';
  const getInputText = isTextarea
    ? `function getInputText() { return inputEl.value.trim(); }`
    : `function getInputText() { return (inputEl.innerText || inputEl.textContent || '').trim(); }`;
  const clearInput = isTextarea
    ? `function clearInput() { inputEl.value = ''; }`
    : `function clearInput() { inputEl.textContent = ''; }`;

  const wrap = t.contentWrap;
  const wrapUserContent = wrap?.includeUser === true;
  const appendCompletionTo = wrap ? 'wrapperEl' : 'contentEl.parentElement';

  const isMcWrap = wrap && wrap.tag !== 'div';
  const isTcWrap = wrap && wrap.tag === 'div';

  const userWrapLine = wrapUserContent && wrap ? wrapDeclCode(wrap, 'tc') : '';
  const userAppend = wrapUserContent
    ? `      tc.appendChild(c); u.appendChild(tc);`
    : `      u.appendChild(c);`;

  const assistantMcLine = isMcWrap && wrap ? wrapDeclCode(wrap, 'mc') : '';
  const assistantTcLine = isTcWrap && wrap ? wrapDeclCode(wrap, 'tc') : '';
  const wrapVar = isMcWrap ? 'mc' : 'tc';
  const assistantAppend = wrap
    ? `      ${wrapVar}.appendChild(c); a.appendChild(av); a.appendChild(${wrapVar});`
    : `      a.appendChild(av); a.appendChild(c);`;

  const counterDecl = t.useResponseCounter ? `    let responseCount = 1;` : '';
  const counterIdAttr = t.useResponseCounter ? `      c.id = 'markdown-content-' + responseCount++;` : '';

  const compButtons = t.completionButtons.map((btn, i) => {
    const lines = [`      const b${i} = document.createElement('${btn.tag || 'button'}');`];
    for (const [k, v] of Object.entries(btn.attrs)) {
      lines.push(`      b${i}.setAttribute('${k}', '${v}');`);
    }
    lines.push(`      b${i}.textContent = '${btn.text}';`);
    lines.push(`      w.appendChild(b${i});`);
    return lines.join('\n');
  }).join('\n');

  const responseSelectors = JSON.stringify(config.inject.responseSelectors || []);
  const completeSelectors = JSON.stringify(config.inject.completeIndicatorSelectors || []);
  const streamingSelectors = JSON.stringify(config.inject.streamingIndicatorSelectors || []);
  const streamingAttrs = JSON.stringify(t.streamingButton.attrs);

  return `
  <script>
    const RESPONSE_SELECTORS = ${responseSelectors};
    const COMPLETE_SELECTORS = ${completeSelectors};
    const STREAMING_SELECTORS = ${streamingSelectors};
    const STREAMING_BUTTON_ATTRS = ${streamingAttrs};

    function removeMatchedNodes(selectors, keepId = null) {
      for (const selector of selectors) {
        try {
          const nodes = document.querySelectorAll(selector);
          for (const node of nodes) {
            if (keepId && node instanceof HTMLElement && node.id === keepId) {
              continue;
            }
            node.remove();
          }
        } catch {
          // Ignore selector parsing/runtime issues in captured pages.
        }
      }
    }

    function ensureChatHistory() {
      let history = document.getElementById('chat-history');
      if (!history) {
        history = document.createElement('div');
        history.id = 'chat-history';
        history.style.padding = '16px';
        history.style.display = 'flex';
        history.style.flexDirection = 'column';
        history.style.gap = '12px';
        document.body.appendChild(history);
      }
      history.innerHTML = '';
      return history;
    }

    function ensureStreamingButton() {
      let button = document.getElementById('mock-streaming-btn');
      if (!button) {
        button = document.createElement('button');
        button.id = 'mock-streaming-btn';
        for (const [key, value] of Object.entries(STREAMING_BUTTON_ATTRS)) {
          button.setAttribute(key, value);
        }
        button.className = 'hidden';
        button.setAttribute('hidden', '');
        button.textContent = '${t.streamingButton.text}';
        document.body.appendChild(button);
      }
      return button;
    }

    removeMatchedNodes(RESPONSE_SELECTORS);
    removeMatchedNodes(COMPLETE_SELECTORS);
    removeMatchedNodes(STREAMING_SELECTORS, 'mock-streaming-btn');

    const chatHistory = ensureChatHistory();
    const streamingBtn = ensureStreamingButton();
    const MOCK_RESPONSE = "${mockResponse}";
${counterDecl}

    ${getInputText}
    ${clearInput}

    function createUserMessage(text) {
      const u = document.createElement('${t.userWrapper.tag}');
${setAttrsCode('u', t.userWrapper.attrs ?? {})}
${setClassCode('u', t.userWrapper.className)}
      const av = document.createElement('div'); av.className = 'avatar';
${userWrapLine}
      const c = document.createElement('${t.userContent.tag}');
${setClassCode('c', t.userContent.className)}
      c.textContent = text;
      u.appendChild(av);
${userAppend}
      return u;
    }

    function createAssistantMessage() {
      const a = document.createElement('${t.assistantWrapper.tag}');
${setAttrsCode('a', t.assistantWrapper.attrs ?? {})}
${setClassCode('a', t.assistantWrapper.className)}
      const av = document.createElement('div'); av.className = 'avatar';
${assistantMcLine}
${assistantTcLine}
      const c = document.createElement('${t.assistantContent.tag}');
${setClassCode('c', t.assistantContent.className)}
${counterIdAttr}
${assistantAppend}
      return { wrapper: a, content: c };
    }

    async function streamResponse(contentEl, wrapperEl) {
      streamingBtn.classList.remove('hidden');
      streamingBtn.removeAttribute('hidden');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) {
        contentEl.textContent += token;
        chatHistory.scrollTop = chatHistory.scrollHeight;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      streamingBtn.classList.add('hidden');
      streamingBtn.setAttribute('hidden', '');
      const w = document.createElement('${t.completionWrapper.tag}');
${setClassCode('w', t.completionWrapper.className)}
${compButtons}
      ${appendCompletionTo}.appendChild(w);
      if (typeof sendBtn !== 'undefined') sendBtn.disabled = false;
    }

    function handleSubmit() {
      const text = getInputText();
      if (!text) return;
      window.__mockLastInput = text;
      chatHistory.appendChild(createUserMessage(text));
      clearInput();
      if (typeof sendBtn !== 'undefined') sendBtn.disabled = true;
      const { wrapper, content } = createAssistantMessage();
      chatHistory.appendChild(wrapper);
      setTimeout(() => streamResponse(content, wrapper), 300);
    }
  </script>`;
}

// ---------------------------------------------------------------------------
// Input area HTML generation
// ---------------------------------------------------------------------------

export function generateInputBindings(config: ProviderConfig): string {
  const t = config.template;
  const inputSelectors = JSON.stringify(config.inject.inputSelectors || []);
  const submitSelectors = JSON.stringify(config.inject.submitSelectors || []);

  const formHandling = `
    const chatForm = inputEl?.closest('form') || sendBtn?.closest('form');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmit();
      });
    }`;

  return `
  <script>
    const INPUT_SELECTORS = ${inputSelectors};
    const SUBMIT_SELECTORS = ${submitSelectors};

    function findAllVisibleElements(selectors) {
      const results = [];
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            if (
              element instanceof HTMLElement &&
              (element.offsetParent !== null || window.getComputedStyle(element).display !== 'none') &&
              !results.includes(element)
            ) {
              results.push(element);
            }
          }
        } catch {
          // Ignore invalid selectors from stale captures.
        }
      }
      return results;
    }

    const inputCandidates = findAllVisibleElements(INPUT_SELECTORS);
    const submitCandidates = findAllVisibleElements(SUBMIT_SELECTORS);
    let inputEl = inputCandidates[0] || null;
    let sendBtn = submitCandidates[0] || null;

    if (!inputEl || submitCandidates.length === 0) {
      const missing = [
        !inputEl ? 'input' : null,
        submitCandidates.length === 0 ? 'submit' : null,
      ].filter(Boolean).join(', ');
      const error = 'Mock binding failed: missing ' + missing + ' element(s) in captured DOM';
      window.__mock_binding_error = error;
      throw new Error(error);
    }

    function normalizeSubmitCandidate(buttonEl) {
      const ariaLabel = (buttonEl.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('voice')) {
        // Captured static pages are often in pre-send state; normalize to send state for offline playback.
        buttonEl.setAttribute('aria-label', 'Send');
      }
      // Captured raw pages are usually in pre-input state, where submit controls may be marked disabled.
      // Normalize to a sendable mock state because no provider runtime is present in simulation files.
      buttonEl.removeAttribute('aria-disabled');
      buttonEl.removeAttribute('disabled');
      if (buttonEl instanceof HTMLButtonElement) {
        buttonEl.disabled = false;
      }
    }

    for (const candidate of submitCandidates) {
      normalizeSubmitCandidate(candidate);
      candidate.addEventListener('click', (e) => {
        ${t.useForm ? 'e.preventDefault(); ' : ''}
        handleSubmit();
      });
    }
${formHandling}
    if (inputEl) {
      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      });
    }
  </script>`;
}

// ---------------------------------------------------------------------------
// Config update
// ---------------------------------------------------------------------------

export function updateMockConfig(key: ProviderKey): void {
  let config: Record<string, { url: string; urlPattern: string }> = {};
  if (existsSync(MOCK_CONFIG_PATH)) {
    config = JSON.parse(readFileSync(MOCK_CONFIG_PATH, 'utf-8'));
  }
  config[key] = {
    url: `file://./tests/fixtures/mock-site/${key}-simulation.html`,
    urlPattern: `${key}-simulation.html`,
  };
  writeFileSync(MOCK_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log('   Updated mock-provider-config.json');
}

// ---------------------------------------------------------------------------
// Process pipeline — takes raw HTML and produces simulation file
// ---------------------------------------------------------------------------

export function processCapture(key: ProviderKey, rawHtml: string): string {
  const config = PROVIDERS[key];
  let html = cleanDom(rawHtml);
  html = injectSentinels(html, config);

  const runtime = generateRuntime(config);
  const bindings = generateInputBindings(config);
  html = html.replace(/<\/body>/i, `${runtime}\n${bindings}\n</body>`);
  return html;
}

async function buildCaptureReport(
  key: ProviderKey,
  rawHtml: string,
  options: ProcessOptions,
): Promise<CaptureReport> {
  const analysis = await analyzeSelectors(rawHtml, PROVIDERS[key]);
  const summary: Record<SelectorGroup, GroupStatus> = {
    input: groupStatusFromReport(analysis.input),
    submit: groupStatusFromReport(analysis.submit),
    response: groupStatusFromReport(analysis.response),
    complete: groupStatusFromReport(analysis.complete),
  };

  const status = isStrictFailure(summary, options.strict) ? 'fail' : 'pass';

  return {
    provider: key,
    timestamp: new Date().toISOString(),
    strict: options.strict,
    rawFile: options.inputPath,
    simulationFile: options.outputPath,
    status,
    summary,
    selectors: analysis,
    recommendations: buildRecommendations(key, analysis),
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      provider: { type: 'string' },
      input: { type: 'string' },
      output: { type: 'string' },
      strict: { type: 'boolean', default: true },
      'artifacts-dir': { type: 'string' },
      'write-report': { type: 'boolean', default: true },
      help: { type: 'boolean', default: false },
    },
    allowNegative: true,
    strict: true,
  });

  if (args.help) {
    console.log(`
Usage: bun scripts/lib/mockCaptureProcess.ts [options]

Options:
  --provider <key>       Provider to process (chatgpt|claude|gemini|grok|perplexity|aistudio)
  --input <path>         Path to raw HTML file (reads from stdin if omitted)
  --output <path>        Output path (defaults to tests/fixtures/mock-site/<key>-simulation.html)
  --strict               Fail generation when required selector groups do not match (default: true)
  --no-strict            Disable strict fail-fast
  --artifacts-dir <path> Directory for capture reports (default: tests/fixtures/mock-site/artifacts)
  --write-report         Write capture report JSON (default: true)
  --no-write-report      Disable report output
  --help                 Show this help
`);
    process.exit(0);
  }

  if (!args.provider) {
    console.error('Error: --provider is required. Valid: ' + PROVIDER_KEYS.join(', '));
    process.exit(1);
  }

  const key = args.provider as ProviderKey;
  if (!PROVIDERS[key]) {
    console.error(`Unknown provider: ${key}. Valid: ${PROVIDER_KEYS.join(', ')}`);
    process.exit(1);
  }

  let rawHtml = '';
  let inputPath = args.input ?? '<stdin>';

  if (args.input) {
    if (!existsSync(args.input)) {
      console.error(`Input file not found: ${args.input}`);
      process.exit(1);
    }
    rawHtml = readFileSync(args.input, 'utf-8');
  } else {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    rawHtml = Buffer.concat(chunks).toString('utf-8');
    if (!rawHtml.trim()) {
      console.error('Error: No input received on stdin. Use --input <path> or pipe HTML.');
      process.exit(1);
    }
  }

  const outputPath = args.output ?? resolve(MOCK_SITE_DIR, `${key}-simulation.html`);
  const options: ProcessOptions = {
    strict: args.strict ?? true,
    inputPath,
    outputPath,
    artifactsDir: args['artifacts-dir'] ?? DEFAULT_ARTIFACTS_DIR,
    writeReport: args['write-report'] ?? true,
  };

  console.log(`Processing ${PROVIDERS[key].displayName} (${key})...`);
  console.log(`   Input: ${(rawHtml.length / 1024).toFixed(1)} KB`);
  console.log(`   Strict mode: ${options.strict ? 'enabled' : 'disabled'}`);

  const report = await buildCaptureReport(key, rawHtml, options);

  if (options.writeReport) {
    const reportPath = writeCaptureReport(report, options.artifactsDir);
    console.log(`   Report: ${reportPath}`);
  }

  if (report.status === 'fail') {
    console.error('   Selector check failed (required groups: input, submit).');
    for (const recommendation of report.recommendations) {
      console.error(`   - ${recommendation}`);
    }
    process.exit(1);
  }

  const html = processCapture(key, rawHtml);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`   Written: ${outputPath} (${(html.length / 1024).toFixed(1)} KB)`);

  updateMockConfig(key);
  console.log('Done.');
}

if (import.meta.main) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
