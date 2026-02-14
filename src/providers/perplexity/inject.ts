import type { ProviderInject } from '../types'

export const inject: ProviderInject = {
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
}
