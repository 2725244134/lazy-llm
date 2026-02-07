import type { ProviderInject } from '../types'

export const inject: ProviderInject = {
  inputSelectors: [
    'div.ProseMirror[contenteditable="true"]',
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true'][data-placeholder*='Ask']",
    "div[contenteditable='true']",
    "textarea[placeholder*='Ask']",
    'textarea',
  ],
  submitSelectors: [
    "button[type='submit'][aria-label='Submit']",
    "button[aria-label*='Submit']",
    "button[aria-label*='Send']",
    "button[type='submit']",
    'form button',
  ],
  responseSelectors: [
    'div.response-content-markdown.markdown',
    '.message-bubble .markdown',
    "div[data-testid='message-text']",
  ],
  streamingIndicatorSelectors: [
    "button[aria-label='Stop']",
    '.loading-indicator',
    '.is-streaming',
  ],
  completeIndicatorSelectors: [
    "button[aria-label='Regenerate']",
    "button[aria-label='Copy']",
    "button[aria-label='Read Aloud']",
  ],
}
