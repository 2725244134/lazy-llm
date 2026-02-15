/**
 * Built-in mock profiles for all supported providers.
 * Mirrors the real provider inject selectors to establish a
 * baseline contract for mock generation and parity checking.
 */

import type { MockProviderProfile } from './mockTypes';

export const MOCK_PROFILES: Record<string, MockProviderProfile> = {
  chatgpt: {
    key: 'chatgpt',
    name: 'ChatGPT',
    realUrl: 'https://chatgpt.com/',
    hostnames: ['chatgpt.com'],
    inputSelectors: [
      'div.ProseMirror#prompt-textarea',
      'div#prompt-textarea[contenteditable="true"]',
      '#prompt-textarea',
    ],
    submitSelectors: [
      "button[data-testid='send-button']",
      "button[data-testid='fruitjuice-send-button']",
      "button[aria-label*='Send']",
    ],
    responseSelectors: [
      "div[data-message-author-role='assistant'] .markdown",
      ".text-message .markdown.prose",
    ],
    streamingIndicatorSelectors: [
      "button[aria-label='Stop generating']",
      "button[data-testid='stop-button']",
    ],
    completeIndicatorSelectors: [
      "button[data-testid='copy-turn-action-button']",
      "button[aria-label='Good response']",
    ],
    extractMode: 'last',
    chatRegionSelector: 'main [class*="react-scroll-to-bottom"]',
    inputRegionSelector: 'form:has(#prompt-textarea)',
  },

  grok: {
    key: 'grok',
    name: 'Grok',
    realUrl: 'https://grok.com/',
    hostnames: ['grok.com'],
    inputSelectors: [
      'div.ProseMirror[contenteditable="true"]',
      "div[contenteditable='true'][role='textbox']",
      "div[contenteditable='true']",
    ],
    submitSelectors: [
      "button[type='submit'][aria-label='Submit']",
      "button[aria-label*='Submit']",
      "button[aria-label*='Send']",
    ],
    responseSelectors: [
      'div.response-content-markdown.markdown',
      '.message-bubble .markdown',
    ],
    streamingIndicatorSelectors: [
      "button[aria-label='Stop']",
      "button[aria-label='Stop generating']",
    ],
    completeIndicatorSelectors: [
      "button[aria-label='Regenerate']",
      "button[aria-label='Copy']",
    ],
    extractMode: 'last',
    chatRegionSelector: 'main [class*="conversation"]',
    inputRegionSelector: 'form:has(.ProseMirror)',
  },

  gemini: {
    key: 'gemini',
    name: 'Gemini',
    realUrl: 'https://gemini.google.com/',
    hostnames: ['gemini.google.com'],
    inputSelectors: [
      'rich-textarea .ql-editor',
      'rich-textarea .ql-editor p',
      "div.ql-editor[contenteditable='true']",
    ],
    submitSelectors: [
      "button[aria-label*='Send']",
      "button[mattooltip*='Send']",
      'button.send-button',
    ],
    responseSelectors: [
      'message-content div.markdown.markdown-main-panel',
      'div.markdown.markdown-main-panel',
    ],
    streamingIndicatorSelectors: [
      "button[aria-label='Stop response']",
      "button[aria-label*='Stop']",
      "button[mattooltip*='Stop']",
    ],
    completeIndicatorSelectors: [
      'model-response:last-of-type message-actions button[aria-label*="Copy"]',
      'model-response:last-of-type message-actions',
    ],
    extractMode: 'last',
    chatRegionSelector: '.conversation-container',
    inputRegionSelector: '.input-area:has(rich-textarea)',
  },
  claude: {
    key: 'claude',
    name: 'Claude',
    realUrl: 'https://claude.ai/',
    hostnames: ['claude.ai'],
    inputSelectors: [
      "div[contenteditable='true'][data-placeholder]",
      "div.ProseMirror[contenteditable='true']",
      "div[contenteditable='true'] p",
      "fieldset div[contenteditable='true']",
      "textarea[placeholder*='Reply']",
      "div[contenteditable='true']",
      'textarea',
    ],
    submitSelectors: [
      "button[aria-label*='Send']",
      "button[aria-label*='send']",
      "fieldset button[type='submit']",
      'form button',
    ],
    responseSelectors: [
      '.font-claude-message',
      'div[data-testid="message-container"] .prose',
      '.prose',
      'div[data-turn-role="assistant"]',
    ],
    streamingIndicatorSelectors: [
      "button[aria-label*='Stop response']",
      "button[aria-label*='Stop']",
      "[data-testid='stop-button']",
      "fieldset button[aria-label*='Stop']",
    ],
    completeIndicatorSelectors: [
      "button[aria-label*='Copy']",
      "button[aria-label*='Retry']",
      "button[aria-label*='Good response']",
    ],
    extractMode: 'last',
    chatRegionSelector: '[class*="thread-content"], [class*="conversation"]',
    inputRegionSelector: 'fieldset:has([contenteditable])',
  },

  perplexity: {
    key: 'perplexity',
    name: 'Perplexity',
    realUrl: 'https://www.perplexity.ai/',
    hostnames: ['www.perplexity.ai', 'perplexity.ai'],
    inputSelectors: [
      '#ask-input[data-lexical-editor="true"]',
      "div#ask-input[contenteditable='true']",
      '#ask-input',
      "div[data-lexical-editor='true'][contenteditable='true']",
      "div[data-lexical-editor='true']",
      "textarea[placeholder*='Ask']",
      "textarea[placeholder*='Anything']",
      "textarea[aria-label*='Ask']",
      'textarea',
      "div[contenteditable='true']",
    ],
    submitSelectors: [
      "button[aria-label='Voice mode']",
      "button[aria-label*='Submit']",
      "button[aria-label*='Send']",
      "button[aria-label*='send']",
      "button[data-testid*='send']",
      "button[data-testid*='submit']",
      "button[type='submit']",
      'form button',
    ],
    responseSelectors: [
      '.prose.dark\\:prose-invert',
      '[id^="markdown-content-"]',
      '.default.font-sans.text-base',
      '.min-w-0.break-words',
    ],
    streamingIndicatorSelectors: [
      "button[aria-label='Stop']",
      "button[aria-label='Stop generating']",
      "button[data-testid*='stop']",
    ],
    completeIndicatorSelectors: [
      "button[aria-label='Copy']",
      "button[aria-label='Share']",
      "button[aria-label='Rewrite']",
    ],
    extractMode: 'last',
    chatRegionSelector: 'main [class*="pb-"]',
    inputRegionSelector: 'div:has(> #ask-input)',
  },

  aistudio: {
    key: 'aistudio',
    name: 'AI Studio',
    realUrl: 'https://aistudio.google.com/',
    hostnames: ['aistudio.google.com'],
    inputSelectors: [
      "textarea[aria-label='Enter a prompt']",
      "textarea[formcontrolname='promptText']",
      "textarea[placeholder*='Start typing']",
      "textarea[placeholder*='prompt']",
      "textarea[aria-label*='prompt']",
      "textarea[aria-label*='Prompt']",
      'ms-prompt-box textarea',
      '.prompt-box-container textarea',
      'textarea.cdk-textarea-autosize',
      'textarea',
      "div[contenteditable='true']",
    ],
    submitSelectors: [
      'ms-run-button button',
      "button[type='submit']",
      "button.ms-button-primary[type='submit']",
      "button[aria-label*='Run']",
      "button[aria-label*='Send']",
      'form button',
    ],
    responseSelectors: [
      'ms-cmark-node.cmark-node',
      '.turn-content ms-text-chunk',
      '.model-prompt-container .turn-content',
      '.text-chunk',
    ],
    streamingIndicatorSelectors: [
      "button[aria-label='Stop']",
      "button[aria-label='Stop generating']",
      "mat-progress-bar[mode='indeterminate']",
      'ms-chat-turn-loader',
    ],
    completeIndicatorSelectors: [
      'ms-chat-turn-options',
      "button[aria-label='Good response']",
      "button[aria-label='Bad response']",
      "button[aria-label='Copy']",
    ],
    extractMode: 'last',
    chatRegionSelector: 'ms-chat-session, .chat-turns-container',
    inputRegionSelector: '.input-area:has(ms-prompt-box)',
  },
};

/** List of all supported provider keys. */
export const SUPPORTED_PROVIDER_KEYS = Object.keys(MOCK_PROFILES);
