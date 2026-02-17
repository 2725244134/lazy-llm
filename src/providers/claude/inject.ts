import type { ProviderInject } from '../types'

export const inject: ProviderInject = {
  inputSelectors: [
    "div.ProseMirror[contenteditable='true']",
    "div[role='textbox'][aria-label='Write your prompt to Claude']",
    "textarea[aria-label='Write your prompt to Claude']",
    "div[contenteditable='true'][data-placeholder]",
    "textarea[placeholder*='Reply']",
    "fieldset div[contenteditable='true']",
    "div[contenteditable='true']",
    'textarea',
  ],
  submitSelectors: [
    "button[aria-label='Send message']",
    "button[aria-label='Send']",
    "button[aria-label*='Send']",
    "button[aria-label*='send']",
    "fieldset button[type='submit']",
    'form button',
  ],
  responseSelectors: [
    '.font-claude-response .standard-markdown',
    '.font-claude-response-body',
    "div[data-is-streaming='false'] .standard-markdown",
    '.font-claude-message',
    'div[data-testid="message-container"] .prose',
    '.prose',
    'div[data-turn-role="assistant"]',
  ],
  streamingIndicatorSelectors: [
    "div[data-is-streaming='true']",
    "button[aria-label*='Stop response']",
    "button[aria-label*='Stop']",
    "[data-testid='stop-button']",
    "fieldset button[aria-label*='Stop']",
  ],
  completeIndicatorSelectors: [
    "button[data-testid='action-bar-copy']",
    "button[aria-label*='Copy']",
    "button[aria-label*='Retry']",
    "button[aria-label*='Good response']",
  ],
}
