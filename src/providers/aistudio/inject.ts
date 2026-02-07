import type { ProviderInject } from '../types'

export const inject: ProviderInject = {
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
    'mat-progress-bar',
    '.is-streaming',
    '.loading',
    'ms-chat-turn-loader',
  ],
  completeIndicatorSelectors: [
    'ms-chat-turn-options',
    "button[aria-label='Good response']",
    "button[aria-label='Bad response']",
    "button[aria-label='Copy']",
  ],
}
