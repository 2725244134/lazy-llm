import type { ProviderInject } from '../types'

export const inject: ProviderInject = {
  inputSelectors: [
    'div.ProseMirror#prompt-textarea',
    'div#prompt-textarea[contenteditable="true"]',
    '#prompt-textarea',
    'div.ProseMirror[contenteditable="true"]',
    'textarea#prompt-textarea',
    "textarea[data-id='root']",
    "textarea[placeholder*='Message']",
    'textarea',
    "div[contenteditable='true']",
  ],
  submitSelectors: [
    'button.composer-submit-button-color',
    "button[data-testid='send-button']",
    "button[data-testid='fruitjuice-send-button']",
    "button[aria-label*='Send']",
    "form button[type='submit']",
    "button[aria-label='Start Voice']",
  ],
  responseSelectors: [
    "div[data-message-author-role='assistant'] .markdown",
    "article[data-turn='assistant'] .markdown",
    "div.agent-turn .markdown",
    ".text-message .markdown.prose",
  ],
  streamingIndicatorSelectors: [
    "button[aria-label='Stop generating']",
    "button[aria-label='Stop response']",
    "button[data-testid='stop-button']",
    "[data-testid='streaming-indicator']",
    "[data-message-author-role='assistant'] [aria-live='polite']",
  ],
  completeIndicatorSelectors: [
    "button[data-testid='copy-turn-action-button']",
    "button[aria-label='Good response']",
    "button[aria-label='Bad response']",
  ],
}
