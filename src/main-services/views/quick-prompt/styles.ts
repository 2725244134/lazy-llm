/**
 * Quick Prompt CSS styles
 */

import {
  ACTIVE_THEME_PRESET,
  getQuickPromptThemeVars,
  renderCssVariableBlock,
} from '@shared-config/src/theme.js';

const QUICK_PROMPT_CSS_VARS = renderCssVariableBlock(
  getQuickPromptThemeVars(ACTIVE_THEME_PRESET)
);

export const QUICK_PROMPT_STYLES = `
:root {
  color-scheme: light;
  ${QUICK_PROMPT_CSS_VARS}
}

html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: hidden;
  font-family: "SF Pro Text", "SF Pro SC", "PingFang SC", "Segoe UI", sans-serif;
}

body {
  display: grid;
  place-items: start center;
}

.panel {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  overflow: hidden;
  border-radius: 18px;
  border: 2.5px solid var(--qp-border);
  background: linear-gradient(180deg, var(--qp-surface), var(--qp-surface-soft));
  box-shadow:
    var(--qp-shadow),
    inset 0 1px 0 var(--qp-inset-top),
    inset 0 -1px 0 var(--qp-inset-bottom);
  backdrop-filter: blur(14px) saturate(118%);
  -webkit-backdrop-filter: blur(14px) saturate(118%);
  transition: border-color 0.16s ease-out, box-shadow 0.16s ease-out;
}

.panel::after {
  content: "";
  position: absolute;
  inset: 3px;
  border-radius: 14px;
  border: 1px solid var(--qp-inner-stroke);
  pointer-events: none;
  opacity: 0.78;
}

.panel:focus-within {
  border-color: var(--qp-border-focus);
  box-shadow:
    var(--qp-shadow-focus),
    inset 0 0 0 1px var(--qp-ring),
    inset 0 1px 0 var(--qp-inset-top-focus),
    inset 0 -1px 0 var(--qp-inset-bottom-focus);
}

.panel:focus-within::after {
  opacity: 0.94;
}

.attachment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  padding: 7px 10px;
  border-radius: 11px;
  border: 1px solid var(--qp-inner-stroke);
  background: rgba(255, 255, 255, 0.34);
}

.attachment-label {
  color: var(--qp-text);
  font-size: 13px;
  line-height: 1.2;
  font-weight: 500;
}

.attachment-clear {
  border: none;
  background: transparent;
  color: var(--qp-border-focus);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  padding: 0;
}

.attachment-clear:hover {
  text-decoration: underline;
}

.attachment-error {
  margin: 0 0 8px 0;
  color: #a61b1b;
  font-size: 12px;
  line-height: 1.3;
}

.input {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--qp-text);
  font-size: 21px;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0.01px;
  min-height: 44px;
  max-height: 240px;
  padding: 0;
  resize: none;
  overflow-y: hidden;
  caret-color: var(--qp-border-focus);
}

.input::placeholder {
  color: var(--qp-placeholder);
  font-weight: 400;
  opacity: 1;
}

.input:focus {
  outline: none;
}

.input::-webkit-scrollbar {
  width: 6px;
}

.input::-webkit-scrollbar-track {
  background: transparent;
}

.input::-webkit-scrollbar-thumb {
  background: var(--qp-scrollbar-thumb);
  border-radius: 3px;
}

.input::-webkit-scrollbar-thumb:hover {
  background: var(--qp-scrollbar-thumb-hover);
}

@media (max-width: 640px) {
  .panel {
    padding: 9px 12px;
    border-radius: 16px;
  }
  .input {
    font-size: 18px;
    min-height: 40px;
  }
}
`;
