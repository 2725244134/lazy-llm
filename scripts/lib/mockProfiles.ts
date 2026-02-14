/**
 * Built-in mock profiles for chatgpt, grok, gemini.
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
  },
};

/** List of all supported provider keys. */
export const SUPPORTED_PROVIDER_KEYS = Object.keys(MOCK_PROFILES);
