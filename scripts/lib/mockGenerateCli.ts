#!/usr/bin/env bun
/**
 * mockGenerateCli.ts
 *
 * Generates an interactive mock HTML page and provider config entry
 * from a provider profile.
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

const MOCK_RESPONSE_TEXT = 'This is a streamed response from the mock server. It simulates how an LLM would generate text token by token. Testing the inject bridge contract end to end.\\n\\nSecond paragraph for multiline extraction verification.';

function generateMockHtml(_providerKey: string, providerName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock ${providerName} Simulation</title>
  <style>
    body { font-family: sans-serif; background-color: #1a1a2e; color: #e0e0e0; margin: 0; display: flex; flex-direction: column; height: 100vh; }
    .chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .message-row { display: flex; padding: 16px; border-radius: 8px; }
    .message-row.user { background-color: #16213e; }
    .message-row.assistant { background-color: #0f3460; }
    .avatar { width: 28px; height: 28px; border-radius: 50%; margin-right: 16px; flex-shrink: 0; }
    .user .avatar { background-color: #5436da; }
    .assistant .avatar { background-color: #19c37d; }
    .content { line-height: 1.6; white-space: pre-wrap; flex: 1; }
    .input-area { padding: 16px; border-top: 1px solid #333; display: flex; justify-content: center; }
    .input-wrapper { width: 100%; max-width: 768px; position: relative; display: flex; background-color: #16213e; border-radius: 8px; border: 1px solid #333; }
    #prompt-textarea { width: 100%; max-height: 200px; padding: 12px 48px 12px 12px; background: transparent; border: none; color: #e0e0e0; resize: none; outline: none; font-family: inherit; font-size: 15px; }
    #send-btn { position: absolute; right: 8px; bottom: 8px; background: #19c37d; border: none; color: white; cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 14px; }
    #send-btn:hover { background-color: #15a86c; }
    #send-btn:disabled { background: #333; color: #666; cursor: not-allowed; }
    .result-streaming::after { content: '\\u258B'; animation: blink 1s step-end infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  </style>
</head>
<body>
  <div class="chat-container" id="chat-history">
    <div class="message-row assistant">
      <div class="avatar"></div>
      <div class="content">Hello! I am a simulated ${providerName}. How can I help you today?</div>
    </div>
  </div>
  <div class="input-area">
    <div class="input-wrapper">
      <textarea id="prompt-textarea" placeholder="Send a message..." rows="1"></textarea>
      <button id="send-btn">Send</button>
    </div>
  </div>

  <script>
    const textarea = document.getElementById('prompt-textarea');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');

    const MOCK_RESPONSE = "${MOCK_RESPONSE_TEXT}";

    function createMessage(role, text) {
      const row = document.createElement('div');
      row.className = 'message-row ' + role;
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = text;
      row.appendChild(avatar);
      row.appendChild(content);
      return row;
    }

    async function streamResponse(contentEl) {
      contentEl.classList.add('result-streaming');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';

      for (const token of tokens) {
        contentEl.textContent += token;
        chatHistory.scrollTop = chatHistory.scrollHeight;
        await new Promise(r => setTimeout(r, 40));
      }

      contentEl.classList.remove('result-streaming');
      sendBtn.disabled = false;
    }

    sendBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) return;

      chatHistory.appendChild(createMessage('user', text));
      textarea.value = '';
      sendBtn.disabled = true;

      const assistantRow = createMessage('assistant', '');
      const contentDiv = assistantRow.querySelector('.content');
      chatHistory.appendChild(assistantRow);

      setTimeout(() => streamResponse(contentDiv), 300);
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  </script>
</body>
</html>`;
}

function main(): void {
  const { provider, outputDir } = parseArgs();

  if (!provider) {
    output({ success: false, error: 'Missing --provider argument' });
  }

  const profile = MOCK_PROFILES[provider];
  if (!profile) {
    output({
      success: false,
      error: `Unknown provider: ${provider}. Supported: ${Object.keys(MOCK_PROFILES).join(', ')}`,
    });
  }

  const resolvedDir = resolve(outputDir);
  if (!existsSync(resolvedDir)) {
    mkdirSync(resolvedDir, { recursive: true });
  }

  // Generate mock HTML
  const htmlFilename = `${provider}-simulation.html`;
  const htmlPath = join(resolvedDir, htmlFilename);
  writeFileSync(htmlPath, generateMockHtml(profile.key, profile.name));

  // Generate / update mock-provider-config.json
  const configPath = join(resolvedDir, 'mock-provider-config.json');
  let existingConfig: MockProviderConfigFile = {};
  if (existsSync(configPath)) {
    try {
      existingConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      // Start fresh if corrupted
    }
  }

  const mockKey = provider;
  const entry: MockProviderConfigEntry = {
    url: `file://./tests/fixtures/mock-site/${htmlFilename}`,
    urlPattern: htmlFilename,
    inputSelectors: ['#prompt-textarea'],
    submitSelectors: ['#send-btn'],
    responseSelectors: ['.message-row.assistant .content'],
    streamingIndicatorSelectors: ['.result-streaming'],
    extractMode: 'last',
  };

  existingConfig[mockKey] = entry;
  writeFileSync(configPath, JSON.stringify(existingConfig, null, 2) + '\n');

  output({
    success: true,
    data: {
      htmlPath,
      configPath,
      mockKey,
    },
  });
}

main();
