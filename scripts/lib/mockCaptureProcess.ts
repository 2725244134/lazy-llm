#!/usr/bin/env bun
/**
 * Mock Capture Process — pure DOM processing pipeline.
 * Accepts raw HTML (from file or stdin) and generates a mock simulation page.
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
  inputWrapper?: 'fieldset';
  useResponseCounter?: boolean;
}

export interface ProviderConfig {
  url: string;
  displayName: string;
  inject: ProviderInject;
  template: MessageTemplate;
}

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
      inputWrapper: 'fieldset',
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
      userContent: { tag: 'div', className: 'default font-sans text-base' },
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
      userContent: { tag: 'ms-text-chunk', className: '' },
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

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const MOCK_SITE_DIR = resolve(ROOT, 'tests/fixtures/mock-site');
const MOCK_CONFIG_PATH = resolve(MOCK_SITE_DIR, 'mock-provider-config.json');

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

// ---------------------------------------------------------------------------
// DOM cleanup — applied to captured HTML
// ---------------------------------------------------------------------------

export function cleanDom(html: string): string {
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  html = html.replace(/<meta\s+[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/gi, '');
  html = html.replace(/<link\s+[^>]*rel\s*=\s*["'](preload|prefetch|preconnect|modulepreload|dns-prefetch)["'][^>]*\/?>/gi, '');
  return html;
}

// ---------------------------------------------------------------------------
// Sentinel injection — add hidden streaming indicator if not present
// ---------------------------------------------------------------------------

export function injectSentinels(html: string, config: ProviderConfig): string {
  const { streamingButton } = config.template;
  const ariaLabel = streamingButton.attrs['aria-label'];
  if (ariaLabel && html.includes(`aria-label="${ariaLabel}"`)) {
    return html;
  }
  const sentinel = `<button ${attrsToString(streamingButton.attrs)} class="hidden" style="display:none!important">${streamingButton.text}</button>`;
  return html.replace(/<\/body>/i, `${sentinel}\n</body>`);
}

// ---------------------------------------------------------------------------
// Runtime script generation
// ---------------------------------------------------------------------------

export function generateRuntime(key: ProviderKey, config: ProviderConfig): string {
  const { template: t, displayName } = config;
  const mockResponse = `This is a streamed response from mock ${displayName}. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.`;

  const isTextarea = t.inputType === 'textarea';
  const getInputText = isTextarea
    ? `function getInputText() { return inputEl.value.trim(); }`
    : `function getInputText() { return (inputEl.innerText || inputEl.textContent || '').trim(); }`;
  const clearInput = isTextarea
    ? `function clearInput() { inputEl.value = ''; }`
    : `function clearInput() { inputEl.innerHTML = '<p><br></p>'; }`;

  const wrap = t.contentWrap;
  const wrapUserContent = wrap?.includeUser === true;
  const appendCompletionTo = wrap ? 'wrapperEl' : 'contentEl.parentElement';

  // Wrap variable name: 'tc' for div-based wraps, 'mc' for custom element wraps.
  // Split into two template lines to preserve the blank-line structure of the original
  // (which had separate conditionals for needsMessageContent and needsTurnContent).
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

  const script = `
  <script>
    const chatHistory = document.getElementById('chat-history');
    const streamingBtn = document.querySelector('[aria-label="${t.streamingButton.attrs['aria-label']}"]') || document.getElementById('streaming-btn');
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
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) {
        contentEl.textContent += token;
        chatHistory.scrollTop = chatHistory.scrollHeight;
        await new Promise(r => setTimeout(r, 40));
      }
      streamingBtn.classList.add('hidden');
      const w = document.createElement('${t.completionWrapper.tag}');
${setClassCode('w', t.completionWrapper.className)}
${compButtons}
      ${appendCompletionTo}.appendChild(w);
      if (typeof sendBtn !== 'undefined') sendBtn.disabled = false;
    }

    function handleSubmit() {
      const text = getInputText(); if (!text) return;
      window.__mockLastInput = text;
      chatHistory.appendChild(createUserMessage(text));
      clearInput();
      if (typeof sendBtn !== 'undefined') sendBtn.disabled = true;
      const { wrapper, content } = createAssistantMessage();
      chatHistory.appendChild(wrapper);
      setTimeout(() => streamResponse(content, wrapper), 300);
    }
  </script>`;

  return script;
}

// ---------------------------------------------------------------------------
// Input area HTML generation
// ---------------------------------------------------------------------------

export function generateInputBindings(_key: ProviderKey, config: ProviderConfig): string {
  const t = config.template;

  const inputSelector = config.inject.inputSelectors[0];
  const sendBtnSelector = config.inject.submitSelectors[0];

  const formHandling = t.useForm
    ? `
    const chatForm = inputEl.closest('form');
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(); });
    }`
    : '';

  return `
  <script>
    const inputEl = document.querySelector('${inputSelector}');
    const sendBtn = document.querySelector('${sendBtnSelector}');
    if (sendBtn) sendBtn.addEventListener('click', (e) => { ${t.useForm ? 'e.preventDefault(); ' : ''}handleSubmit(); });
${formHandling}
    if (inputEl) inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    });
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
  console.log(`   Updated mock-provider-config.json`);
}

// ---------------------------------------------------------------------------
// .gitignore maintenance
// ---------------------------------------------------------------------------

export function ensureGitignoreAuth(): void {
  const gitignorePath = resolve(ROOT, '.gitignore');
  if (!existsSync(gitignorePath)) return;
  const content = readFileSync(gitignorePath, 'utf-8');
  if (!content.includes('auth/')) {
    writeFileSync(gitignorePath, content.trimEnd() + '\nauth/\n', 'utf-8');
    console.log('Added auth/ to .gitignore');
  }
}

// ---------------------------------------------------------------------------
// Process pipeline — takes raw HTML and produces simulation file
// ---------------------------------------------------------------------------

export function processCapture(key: ProviderKey, rawHtml: string): string {
  const config = PROVIDERS[key];
  let html = cleanDom(rawHtml);
  html = injectSentinels(html, config);

  const runtime = generateRuntime(key, config);
  const bindings = generateInputBindings(key, config);
  html = html.replace(/<\/body>/i, `${runtime}\n${bindings}\n</body>`);
  return html;
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
      help: { type: 'boolean', default: false },
    },
    strict: true,
  });

  if (args.help) {
    console.log(`
Usage: bun scripts/lib/mockCaptureProcess.ts [options]

Options:
  --provider <key>   Provider to process (chatgpt|claude|gemini|grok|perplexity|aistudio)
  --input <path>     Path to raw HTML file (reads from stdin if omitted)
  --output <path>    Output path (defaults to tests/fixtures/mock-site/<key>-simulation.html)
  --help             Show this help
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

  // Read raw HTML from file or stdin
  let rawHtml: string;
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

  console.log(`Processing ${PROVIDERS[key].displayName} (${key})...`);
  console.log(`   Input: ${(rawHtml.length / 1024).toFixed(1)} KB`);

  ensureGitignoreAuth();

  const html = processCapture(key, rawHtml);

  const outPath = args.output ?? resolve(MOCK_SITE_DIR, `${key}-simulation.html`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf-8');
  console.log(`   Written: ${outPath} (${(html.length / 1024).toFixed(1)} KB)`);

  updateMockConfig(key);
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
