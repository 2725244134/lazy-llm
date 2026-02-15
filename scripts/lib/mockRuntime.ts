/**
 * mockRuntime.ts
 *
 * Shared mock interaction runtime used by both the hand-written template
 * generator (mockGenerateCli.ts) and the style-aware transform pipeline
 * (mockTransformCli.ts).
 *
 * Each provider's runtime relies on fixed element IDs:
 *   - #chat-history — chat message container
 *   - #send-btn — submit button
 *   - #streaming-btn — streaming indicator (toggled via .hidden)
 *   - Provider-specific input element IDs (prompt-textarea, grok-input, etc.)
 */

/** Per-provider mock response text for streaming simulation. */
export const MOCK_RESPONSES: Record<string, string> = {
  chatgpt:
    'This is a streamed response from mock ChatGPT. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
  grok: 'This is a streamed response from mock Grok. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
  gemini:
    'This is a streamed response from mock Gemini. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
  claude:
    'This is a streamed response from mock Claude. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
  perplexity:
    'This is a streamed response from mock Perplexity. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
  aistudio:
    'This is a streamed response from mock AI Studio. It simulates token-by-token generation to verify the inject bridge contract.\\n\\nSecond paragraph for multiline extraction.',
};

// ---------------------------------------------------------------------------
// Per-provider runtime <script> generators
// ---------------------------------------------------------------------------

function chatgptRuntime(mockResp: string): string {
  return `
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
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });`;
}

function grokRuntime(mockResp: string): string {
  return `
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
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } });`;
}

function geminiRuntime(mockResp: string): string {
  return `
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
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });`;
}

function claudeRuntime(mockResp: string): string {
  return `
    const inputEl = document.getElementById('claude-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const streamingBtn = document.getElementById('streaming-btn');
    const MOCK_RESPONSE = "${mockResp}";

    function getInputText() { return (inputEl.innerText || inputEl.textContent || '').trim(); }
    function clearInput() { inputEl.innerHTML = '<p><br></p>'; }

    function createUserMessage(text) {
      const row = document.createElement('div');
      row.className = 'message-row user';
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'prose'; c.textContent = text;
      row.appendChild(av); row.appendChild(c); return row;
    }
    function createAssistantMessage() {
      const row = document.createElement('div');
      row.className = 'message-row assistant';
      row.setAttribute('data-turn-role', 'assistant');
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'font-claude-message';
      row.appendChild(av); row.appendChild(c); return { row, content: c };
    }
    async function streamResponse(contentEl) {
      streamingBtn.classList.remove('hidden');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) { contentEl.textContent += token; chatHistory.scrollTop = chatHistory.scrollHeight; await new Promise(r => setTimeout(r, 40)); }
      streamingBtn.classList.add('hidden');
      const bar = document.createElement('div'); bar.className = 'action-bar';
      const cp = document.createElement('button'); cp.setAttribute('aria-label','Copy'); cp.textContent = 'Copy';
      const rt = document.createElement('button'); rt.setAttribute('aria-label','Retry'); rt.textContent = 'Retry';
      const lk = document.createElement('button'); lk.setAttribute('aria-label','Good response'); lk.textContent = 'Like';
      bar.appendChild(cp); bar.appendChild(rt); bar.appendChild(lk);
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
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });`;
}

function perplexityRuntime(mockResp: string): string {
  return `
    const inputEl = document.getElementById('ask-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const streamingBtn = document.getElementById('streaming-btn');
    let responseCount = 1;
    const MOCK_RESPONSE = "${mockResp}";

    function getInputText() { return (inputEl.innerText || inputEl.textContent || '').trim(); }
    function clearInput() { inputEl.innerHTML = '<p><br></p>'; }

    function createUserQuery(text) {
      const row = document.createElement('div'); row.className = 'query-row';
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'default font-sans text-base'; c.textContent = text;
      row.appendChild(av); row.appendChild(c); return row;
    }
    function createAnswerRow() {
      const row = document.createElement('div'); row.className = 'answer-row';
      const av = document.createElement('div'); av.className = 'avatar';
      const c = document.createElement('div'); c.className = 'prose';
      c.id = 'markdown-content-' + responseCount++;
      row.appendChild(av); row.appendChild(c); return { row, content: c };
    }
    async function streamResponse(contentEl) {
      streamingBtn.classList.remove('hidden');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) { contentEl.textContent += token; chatHistory.scrollTop = chatHistory.scrollHeight; await new Promise(r => setTimeout(r, 40)); }
      streamingBtn.classList.add('hidden');
      const bar = document.createElement('div'); bar.className = 'action-bar';
      const cp = document.createElement('button'); cp.setAttribute('aria-label','Copy'); cp.textContent = 'Copy';
      const sh = document.createElement('button'); sh.setAttribute('aria-label','Share'); sh.textContent = 'Share';
      const rw = document.createElement('button'); rw.setAttribute('aria-label','Rewrite'); rw.textContent = 'Rewrite';
      bar.appendChild(cp); bar.appendChild(sh); bar.appendChild(rw);
      contentEl.parentElement.appendChild(bar);
      sendBtn.disabled = false;
    }
    sendBtn.addEventListener('click', () => {
      const text = getInputText(); if (!text) return;
      window.__mockLastInput = text;
      chatHistory.appendChild(createUserQuery(text)); clearInput(); sendBtn.disabled = true;
      const { row, content } = createAnswerRow(); chatHistory.appendChild(row);
      setTimeout(() => streamResponse(content), 300);
    });
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });`;
}

function aistudioRuntime(mockResp: string): string {
  return `
    const inputEl = document.getElementById('aistudio-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const streamingBtn = document.getElementById('streaming-btn');
    const MOCK_RESPONSE = "${mockResp}";

    function getInputText() { return inputEl.value.trim(); }
    function clearInput() { inputEl.value = ''; }

    function createUserTurn(text) {
      const turn = document.createElement('ms-chat-turn');
      turn.className = 'user-turn';
      const av = document.createElement('div'); av.className = 'avatar';
      const tc = document.createElement('div'); tc.className = 'turn-content';
      const chunk = document.createElement('ms-text-chunk');
      chunk.textContent = text;
      tc.appendChild(chunk); turn.appendChild(av); turn.appendChild(tc); return turn;
    }
    function createModelTurn() {
      const turn = document.createElement('ms-chat-turn');
      turn.className = 'model-turn';
      const av = document.createElement('div'); av.className = 'avatar';
      const tc = document.createElement('div'); tc.className = 'turn-content';
      const node = document.createElement('ms-cmark-node');
      node.className = 'cmark-node';
      tc.appendChild(node); turn.appendChild(av); turn.appendChild(tc);
      return { turn, content: node };
    }
    async function streamResponse(contentEl, turnEl) {
      streamingBtn.classList.remove('hidden');
      const tokens = MOCK_RESPONSE.split(/(?=\\s)/);
      contentEl.textContent = '';
      for (const token of tokens) { contentEl.textContent += token; chatHistory.scrollTop = chatHistory.scrollHeight; await new Promise(r => setTimeout(r, 40)); }
      streamingBtn.classList.add('hidden');
      const opts = document.createElement('ms-chat-turn-options');
      const cp = document.createElement('button'); cp.setAttribute('aria-label','Copy'); cp.textContent = 'Copy';
      const gd = document.createElement('button'); gd.setAttribute('aria-label','Good response'); gd.textContent = 'Good';
      const bd = document.createElement('button'); bd.setAttribute('aria-label','Bad response'); bd.textContent = 'Bad';
      opts.appendChild(cp); opts.appendChild(gd); opts.appendChild(bd);
      turnEl.appendChild(opts);
      sendBtn.disabled = false;
    }
    sendBtn.addEventListener('click', () => {
      const text = getInputText(); if (!text) return;
      window.__mockLastInput = text;
      chatHistory.appendChild(createUserTurn(text)); clearInput(); sendBtn.disabled = true;
      const { turn, content } = createModelTurn(); chatHistory.appendChild(turn);
      setTimeout(() => streamResponse(content, turn), 300);
    });
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); } });`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const RUNTIME_GENERATORS: Record<string, (mockResp: string) => string> = {
  chatgpt: chatgptRuntime,
  grok: grokRuntime,
  gemini: geminiRuntime,
  claude: claudeRuntime,
  perplexity: perplexityRuntime,
  aistudio: aistudioRuntime,
};

/**
 * Generate the provider-specific `<script>` block content for a mock page.
 * This is used by both the hand-written template generator and the
 * style-aware transform pipeline.
 */
export function generateProviderRuntime(provider: string): string {
  const gen = RUNTIME_GENERATORS[provider];
  if (!gen) {
    throw new Error(`No runtime generator for provider: ${provider}`);
  }
  const mockResp = MOCK_RESPONSES[provider] ?? MOCK_RESPONSES.chatgpt;
  return gen(mockResp);
}
