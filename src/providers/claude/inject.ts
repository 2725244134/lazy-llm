import type { ProviderInject } from '../types'

export const inject: ProviderInject = {
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
    "button[aria-label*='Stop']",
    "[data-testid='stop-button']",
    '.is-streaming',
  ],
  completeIndicatorSelectors: [
    "button[aria-label*='Copy']",
    "button[aria-label*='Retry']",
    "button[aria-label*='Good response']",
  ],
}
