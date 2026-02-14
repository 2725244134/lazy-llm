#!/usr/bin/env bun
/**
 * mockGenerateCli.ts
 *
 * Generates interactive mock HTML pages that replicate real provider
 * DOM structures. Each provider has a dedicated template function that
 * produces DOM matching the real site selectors so the inject runtime
 * exercises the exact same code paths (Lexical, ProseMirror, Quill, etc.).
 *
 * Usage:
 *   bun scripts/lib/mockGenerateCli.ts --provider chatgpt [--output-dir tests/fixtures/mock-site]
 *
 * Output: JSON CliOutput with generated file paths to stdout.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { MOCK_PROFILES } from './mockProfiles';
import type { CliOutput, MockProviderConfigEntry, MockProviderConfigFile } from './mockTypes';

function parseArgs(): { provider: string; outputDir: string } {
  const args = process.argv.slice(2);
  let provider = '';
  let outputDir = 'tests/fixtures/mock-site';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      provider = args[++i];
    } else if (args[i] === '--output-dir' && args[i + 1]) {
      outputDir = args[++i];
    }
  }

  return { provider, outputDir };
}

function output<T>(result: CliOutput<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Per-provider mock response text
// ---------------------------------------------------------------------------

const MOCK_RESPONSES: Record<string, string> = {
  chatgpt: 'This is a streamed response from mock ChatGPT. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
  grok: 'This is a streamed response from mock Grok. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
  gemini: 'This is a streamed response from mock Gemini. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
};

// ---------------------------------------------------------------------------
// ChatGPT template: Lexical contenteditable + data-testid selectors
// ---------------------------------------------------------------------------

function generateChatGPTHtml(): string {
  const mockResp = MOCK_RESPONSES.chatgpt;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock ChatGPT Simulation</title>
  <style>
    body { font-family: sans-serif; background-color: #343541; color: #ececf1; margin: 0; display: flex; flex-direction: column; height: 100vh; }
    .chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    [data-message-author-role] { display: flex; padding: 16px; border-radius: 8px; }
    [data-message-author-role="user"] { background-color: #343541; }
    [data-message-author-role="assistant"] { background-color: #444654; }
    .avatar { width: 28px; height: 28px; border-radius: 50%; margin-right: 16px; flex-shrink: 0; }
    [data-message-author-role="user"] .avatar { background-color: #5436da; }
    [data-message-author-role="assistant"] .avatar { background-color: #19c37d; }
    .markdown { line-height: 1.6; white-space: pre-wrap; flex: 1; }
    .input-area { padding: 16px; border-top: 1px solid #565869; display: flex; justify-content: center; }
    .input-wrapper { width: 100%; max-width: 768px; position: relative; display: flex; background-color: #40414f; border-radius: 8px; }
    .ProseMirror { width: 100%; min-height: 24px; max-height: 200px; padding: 12px 48px 12px 12px; background: transparent; border: none; color: #ececf1; outline: none; font-family: inherit; font-size: 15px; overflow-y: auto; }
    .ProseMirror p { margin: 0; }
    .ProseMirror:empty::before { content: attr(data-placeholder); color: #8e8ea0; }
    [data-testid="send-button"] { position: absolute; right: 8px; bottom: 8px; background: #19c37d; border: none; color: white; cursor: pointer; padding: 6px 10px; border-radius: 6px; }
    [data-testid="send-button"]:disabled { background: #565869; cursor: not-allowed; }
    .action-bar { display: flex; gap: 8px; padding: 4px 0; margin-top: 8px; }
    .action-bar button { background: transparent; border: 1px solid #565869; color: #ececf1; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="chat-container" id="chat-history">
    <div data-message-author-role="assistant">
      <div class="avatar"></div>
      <div class="markdown">Hello! I am a simulated ChatGPT. How can I help you today?</div>
    </div>
  </div>
  <button aria-label="Stop generating" data-testid="stop-button" class="hidden" id="streaming-btn">Stop generating</button>
  <div class="input-area">
    <div class="input-wrapper">
      <div class="ProseMirror" id="prompt-textarea" contenteditable="true"
           data-lexical-editor="true" role="textbox" aria-label="Message ChatGPT"
           data-placeholder="Message ChatGPT..."><p><br></p></div>
      <button data-testid="send-button" aria-label="Send prompt" id="send-btn">Send</button>
    </div>
  </div>
  <script>
    const inputEl = document.getElementById('prompt-textarea');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const streamingBtn = document.getElementById('streaming-btn');
    const MOCK_RESPONSE = "${mockResp}";

    function getInputText() { return (inputEl.innerText || inputEl.textContent || '').trim(); }
    function clearInput() { inputEl.innerHTML = '<p><br></p>'; }

    function createUserMessage(text) {
      const row = document.createElement('div');
      row.setAttribute('data-message-author-role', 'user');
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'markdown'; c.textContent = text;
      row.appendChild(av); row.appendChild(c); return row;
    }
    function createAssistantMessage() {
      const row = document.createElement('div');
      row.setAttribute('data-message-author-role', 'assistant');
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'markdown';
      row.appendChild(av); row.appendChild(c); return { row, content: c };
    }
    async function streamResponse(contentEl) {
      streamingBtn.classList.remove('hidden');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) { contentEl.textContent += token; chatHistory.scrollTop = chatHistory.scrollHeight; await new Promise(r => setTimeout(r, 40)); }
      streamingBtn.classList.add('hidden');
      const bar = document.createElement('div'); bar.className = 'action-bar';
      const cp = document.createElement('button'); cp.setAttribute('data-testid','copy-turn-action-button'); cp.textContent = 'Copy';
      const lk = document.createElement('button'); lk.setAttribute('aria-label','Good response'); lk.textContent = 'Like';
      const dl = document.createElement('button'); dl.setAttribute('aria-label','Bad response'); dl.textContent = 'Dislike';
      bar.appendChild(cp); bar.appendChild(lk); bar.appendChild(dl);
      contentEl.parentElement.appendChild(bar);
      sendBtn.disabled = false;
    }
    sendBtn.addEventListener('click', () => {
      const text = getInputText(); if (!text) return;
      window.__mockLastInput = text;
      chatHistory.appendChild(createUserMessage(text)); clearInput(); sendBtn.disabled = true;
      const { row, content } = createAssistantMessage(); chatHistory.appendChild(row);
      setTimeout(() => streamResponse(content), 300);
    });
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Grok template: ProseMirror contenteditable + form submit
// ---------------------------------------------------------------------------

function generateGrokHtml(): string {
  const mockResp = MOCK_RESPONSES.grok;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Grok Simulation</title>
  <style>
    body { font-family: sans-serif; background-color: #000000; color: #e8e8e8; margin: 0; display: flex; flex-direction: column; height: 100vh; }
    .chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .message-bubble { display: flex; padding: 16px; border-radius: 8px; flex-direction: column; }
    .message-bubble.user-msg { background-color: #1a1a1a; }
    .message-bubble.assistant-msg { background-color: #0d0d0d; }
    .avatar { width: 28px; height: 28px; border-radius: 50%; margin-bottom: 8px; flex-shrink: 0; }
    .user-msg .avatar { background-color: #5436da; }
    .assistant-msg .avatar { background-color: #1d9bf0; }
    .user-text { line-height: 1.6; white-space: pre-wrap; }
    .response-content-markdown.markdown { line-height: 1.6; white-space: pre-wrap; }
    .input-area { padding: 16px; border-top: 1px solid #333; display: flex; justify-content: center; }
    form { width: 100%; max-width: 768px; position: relative; display: flex; background-color: #1a1a1a; border-radius: 8px; border: 1px solid #333; }
    .ProseMirror { width: 100%; min-height: 24px; max-height: 200px; padding: 12px 48px 12px 12px; background: transparent; border: none; color: #e8e8e8; outline: none; font-family: inherit; font-size: 15px; overflow-y: auto; }
    .ProseMirror p { margin: 0; }
    .ProseMirror:empty::before { content: attr(data-placeholder); color: #666; }
    button[type="submit"] { position: absolute; right: 8px; bottom: 8px; background: #1d9bf0; border: none; color: white; cursor: pointer; padding: 6px 10px; border-radius: 6px; }
    button[type="submit"]:disabled { background: #333; cursor: not-allowed; }
    .action-bar { display: flex; gap: 8px; padding: 4px 0; margin-top: 8px; }
    .action-bar button { background: transparent; border: 1px solid #333; color: #e8e8e8; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="chat-container" id="chat-history">
    <div class="message-bubble assistant-msg">
      <div class="avatar"></div>
      <div class="response-content-markdown markdown">Hello! I am a simulated Grok. How can I help you today?</div>
    </div>
  </div>
  <button aria-label="Stop" class="hidden" id="streaming-btn">Stop</button>
  <div class="input-area">
    <form id="chat-form">
      <div class="ProseMirror" contenteditable="true" role="textbox"
           data-placeholder="Ask Grok anything" id="grok-input"><p><br></p></div>
      <button type="submit" aria-label="Submit" id="send-btn">Send</button>
    </form>
  </div>
  <script>
    const inputEl = document.querySelector('.ProseMirror[contenteditable="true"]');
    const sendBtn = document.getElementById('send-btn');
    const chatForm = document.getElementById('chat-form');
    const chatHistory = document.getElementById('chat-history');
    const streamingBtn = document.getElementById('streaming-btn');
    const MOCK_RESPONSE = "${mockResp}";

    function getInputText() { return (inputEl.innerText || inputEl.textContent || '').trim(); }
    function clearInput() { inputEl.innerHTML = '<p><br></p>'; }

    function createUserMessage(text) {
      const b = document.createElement('div'); b.className = 'message-bubble user-msg';
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'user-text'; c.textContent = text;
      b.appendChild(av); b.appendChild(c); return b;
    }
    function createAssistantMessage() {
      const b = document.createElement('div'); b.className = 'message-bubble assistant-msg';
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'response-content-markdown markdown';
      b.appendChild(av); b.appendChild(c); return { bubble: b, content: c };
    }
    async function streamResponse(contentEl) {
      streamingBtn.classList.remove('hidden');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) { contentEl.textContent += token; chatHistory.scrollTop = chatHistory.scrollHeight; await new Promise(r => setTimeout(r, 40)); }
      streamingBtn.classList.add('hidden');
      const bar = document.createElement('div'); bar.className = 'action-bar';
      const rg = document.createElement('button'); rg.setAttribute('aria-label','Regenerate'); rg.textContent = 'Regenerate';
      const cp = document.createElement('button'); cp.setAttribute('aria-label','Copy'); cp.textContent = 'Copy';
      const rd = document.createElement('button'); rd.setAttribute('aria-label','Read Aloud'); rd.textContent = 'Read Aloud';
      bar.appendChild(rg); bar.appendChild(cp); bar.appendChild(rd);
      contentEl.parentElement.appendChild(bar);
      sendBtn.disabled = false;
    }
    function handleSubmit() {
      const text = getInputText(); if (!text) return;
      window.__mockLastInput = text;
      chatHistory.appendChild(createUserMessage(text)); clearInput(); sendBtn.disabled = true;
      const { bubble, content } = createAssistantMessage(); chatHistory.appendChild(bubble);
      setTimeout(() => streamResponse(content), 300);
    }
    chatForm.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(); });
    sendBtn.addEventListener('click', (e) => { e.preventDefault(); handleSubmit(); });
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } });
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Gemini template: rich-textarea + ql-editor Quill + model-response custom elements
// ---------------------------------------------------------------------------

function generateGeminiHtml(): string {
  const mockResp = MOCK_RESPONSES.gemini;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Gemini Simulation</title>
  <style>
    body { font-family: sans-serif; background-color: #1e1f20; color: #e3e3e3; margin: 0; display: flex; flex-direction: column; height: 100vh; }
    .chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    model-response { display: block; padding: 16px; border-radius: 8px; background-color: #1e1f20; }
    .user-query { display: block; padding: 16px; border-radius: 8px; background-color: #282a2c; }
    message-content { display: block; }
    message-actions { display: flex; gap: 8px; padding: 4px 0; margin-top: 8px; }
    message-actions button { background: transparent; border: 1px solid #3c4043; color: #e3e3e3; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .markdown.markdown-main-panel { line-height: 1.6; white-space: pre-wrap; }
    .user-text { line-height: 1.6; white-space: pre-wrap; }
    .avatar { width: 28px; height: 28px; border-radius: 50%; margin-bottom: 8px; flex-shrink: 0; }
    .user-query .avatar { background-color: #5436da; }
    model-response .avatar { background-color: #8ab4f8; }
    .input-area { padding: 16px; border-top: 1px solid #3c4043; display: flex; justify-content: center; align-items: flex-end; gap: 8px; }
    .input-wrapper { width: 100%; max-width: 768px; position: relative; display: flex; align-items: flex-end; }
    rich-textarea { display: block; flex: 1; background-color: #282a2c; border-radius: 8px; border: 1px solid #3c4043; }
    .ql-editor { min-height: 24px; max-height: 200px; padding: 12px; background: transparent; color: #e3e3e3; outline: none; font-family: inherit; font-size: 15px; overflow-y: auto; }
    .ql-editor p { margin: 0; }
    .ql-editor:empty::before { content: 'Enter a prompt here'; color: #80868b; font-style: italic; }
    button.send-button { background: #8ab4f8; border: none; color: #1e1f20; cursor: pointer; padding: 8px 12px; border-radius: 50%; margin-left: 8px; font-size: 14px; flex-shrink: 0; }
    button.send-button:disabled { background: #3c4043; color: #666; cursor: not-allowed; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="chat-container" id="chat-history">
    <model-response>
      <div class="avatar"></div>
      <message-content>
        <div class="markdown markdown-main-panel">Hello! I am a simulated Gemini. How can I help you today?</div>
      </message-content>
    </model-response>
  </div>
  <button aria-label="Stop response" class="hidden" id="streaming-btn">Stop</button>
  <div class="input-area">
    <div class="input-wrapper">
      <rich-textarea>
        <div class="ql-editor" contenteditable="true" role="textbox" id="gemini-input"><p><br></p></div>
      </rich-textarea>
      <button aria-label="Send message" class="send-button" id="send-btn">Send</button>
    </div>
  </div>
  <script>
    const inputEl = document.querySelector('rich-textarea .ql-editor');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const streamingBtn = document.getElementById('streaming-btn');
    const MOCK_RESPONSE = "${mockResp}";

    function getInputText() { return (inputEl.innerText || inputEl.textContent || '').trim(); }
    function clearInput() { inputEl.innerHTML = '<p><br></p>'; }

    function createUserQuery(text) {
      const q = document.createElement('div'); q.className = 'user-query';
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'user-text'; c.textContent = text;
      q.appendChild(av); q.appendChild(c); return q;
    }
    function createModelResponse() {
      const r = document.createElement('model-response');
      const av = document.createElement('div'); av.className = 'avatar';
      const mc = document.createElement('message-content');
      const md = document.createElement('div'); md.className = 'markdown markdown-main-panel';
      mc.appendChild(md); r.appendChild(av); r.appendChild(mc);
      return { response: r, markdown: md };
    }
    async function streamResponse(contentEl, responseEl) {
      streamingBtn.classList.remove('hidden');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) { contentEl.textContent += token; chatHistory.scrollTop = chatHistory.scrollHeight; await new Promise(r => setTimeout(r, 40)); }
      streamingBtn.classList.add('hidden');
      const acts = document.createElement('message-actions');
      const cp = document.createElement('button'); cp.setAttribute('aria-label','Copy'); cp.textContent = 'Copy';
      const ch = document.createElement('button'); ch.setAttribute('aria-label','Double-check response'); ch.textContent = 'Double-check';
      acts.appendChild(cp); acts.appendChild(ch);
      responseEl.appendChild(acts);
      sendBtn.disabled = false;
    }
    sendBtn.addEventListener('click', () => {
      const text = getInputText(); if (!text) return;
      window.__mockLastInput = text;
      chatHistory.appendChild(createUserQuery(text)); clearInput(); sendBtn.disabled = true;
      const { response, markdown } = createModelResponse(); chatHistory.appendChild(response);
      setTimeout(() => streamResponse(markdown, response), 300);
    });
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Provider template dispatch
// ---------------------------------------------------------------------------

const PROVIDER_GENERATORS: Record<string, () => string> = {
  chatgpt: generateChatGPTHtml,
  grok: generateGrokHtml,
  gemini: generateGeminiHtml,
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const { provider, outputDir } = parseArgs();

  if (!provider) {
    return output({ success: false, error: 'Missing --provider argument' });
  }

  const profile = MOCK_PROFILES[provider];
  if (!profile) {
    return output({
      success: false,
      error: `Unknown provider: ${provider}. Supported: ${Object.keys(MOCK_PROFILES).join(', ')}`,
    });
  }

  const generator = PROVIDER_GENERATORS[provider];
  if (!generator) {
    return output({
      success: false,
      error: `No template for provider: ${provider}. Available: ${Object.keys(PROVIDER_GENERATORS).join(', ')}`,
    });
  }

  const resolvedDir = resolve(outputDir);
  if (!existsSync(resolvedDir)) {
    mkdirSync(resolvedDir, { recursive: true });
  }

  // Generate mock HTML
  const htmlFilename = `${provider}-simulation.html`;
  const htmlPath = join(resolvedDir, htmlFilename);
  writeFileSync(htmlPath, generator());

  // Generate / update mock-provider-config.json
  // Only url + urlPattern — real selectors come from providers/*/inject.ts
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
    url: `file://./tests/fixtures/mock-site/${htmlFilename}`,
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
