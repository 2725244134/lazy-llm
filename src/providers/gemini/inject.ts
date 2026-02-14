import type { ProviderInject } from '../types'

export const inject: ProviderInject = {
  inputSelectors: [
    'rich-textarea .ql-editor',
    'rich-textarea .ql-editor p',
    "div.ql-editor[contenteditable='true']",
    'div.ql-editor p',
    'rich-textarea textarea',
    'textarea.ql-editor',
    "div[contenteditable='true'][aria-label*='Enter']",
    "textarea[aria-label*='Enter']",
    "textarea[aria-label*='Ask']",
    "textarea[aria-label*='Message']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']",
    'textarea',
  ],
  submitSelectors: [
    "button[aria-label*='Send']",
    "button[mattooltip*='Send']",
    'button.send-button',
    "form button[type='submit']",
  ],
  responseSelectors: [
    'message-content div.markdown.markdown-main-panel',
    'div.markdown.markdown-main-panel',
    '.response-container-content .markdown',
    'model-response .markdown',
    '.model-response-text .markdown',
  ],
  streamingIndicatorSelectors: [
    "[aria-busy='true']",
    "button[aria-label*='Stop']",
    "button[mattooltip*='Stop']",
    '.typing-indicator',
    "mat-progress-bar[mode='indeterminate']",
  ],
  completeIndicatorSelectors: [
    'message-actions button[aria-label*="Copy"]',
    "button[aria-label='Double-check response']",
    'message-actions',
  ],
}
