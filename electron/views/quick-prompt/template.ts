/**
 * Quick Prompt HTML template builder
 * Generates the data URL for the quick prompt overlay
 */

import { QUICK_PROMPT_STYLES } from './styles.js';
import { QUICK_PROMPT_SCRIPT } from './script.js';

export function buildQuickPromptHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quick Prompt</title>
    <style>${QUICK_PROMPT_STYLES}</style>
  </head>
  <body>
    <div class="panel" data-testid="quick-prompt-overlay">
      <textarea
        id="quickPromptInput"
        class="input"
        data-testid="quick-prompt-input"
        placeholder="Type your prompt and press Enter"
        autocomplete="off"
      ></textarea>
    </div>
    <script>${QUICK_PROMPT_SCRIPT}</script>
  </body>
</html>`;
}

export function buildQuickPromptDataUrl(): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(buildQuickPromptHtml())}`;
}
