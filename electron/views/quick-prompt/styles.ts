/**
 * Quick Prompt CSS styles
 * Style: Clear hierarchy + accessible contrast + compact spacing
 */

export const QUICK_PROMPT_STYLES = `
:root {
  color-scheme: light;
  --qp-surface: rgba(255, 255, 255, 0.98);
  --qp-surface-soft: rgba(248, 250, 252, 0.95);
  --qp-border: rgba(15, 23, 42, 0.14);
  --qp-border-focus: #2563eb;
  --qp-ring: rgba(37, 99, 235, 0.2);
  --qp-text: #0f172a;
  --qp-placeholder: #475569;
  --qp-shadow: 0 12px 28px rgba(15, 23, 42, 0.17);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --qp-surface: rgba(17, 24, 39, 0.96);
    --qp-surface-soft: rgba(15, 23, 42, 0.93);
    --qp-border: rgba(148, 163, 184, 0.36);
    --qp-border-focus: #60a5fa;
    --qp-ring: rgba(96, 165, 250, 0.26);
    --qp-text: #f8fafc;
    --qp-placeholder: #cbd5e1;
    --qp-shadow: 0 14px 34px rgba(2, 6, 23, 0.52);
  }
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
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid var(--qp-border);
  background: linear-gradient(180deg, var(--qp-surface), var(--qp-surface-soft));
  box-shadow: var(--qp-shadow);
  backdrop-filter: blur(14px) saturate(118%);
  -webkit-backdrop-filter: blur(14px) saturate(118%);
  transition: border-color 0.16s ease-out, box-shadow 0.16s ease-out;
}

.panel:focus-within {
  border-color: var(--qp-border-focus);
  box-shadow:
    0 0 0 3px var(--qp-ring),
    var(--qp-shadow);
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
  background: rgba(71, 85, 105, 0.45);
  border-radius: 3px;
}

.input::-webkit-scrollbar-thumb:hover {
  background: rgba(71, 85, 105, 0.66);
}

@media (max-width: 640px) {
  .panel {
    padding: 9px 12px;
    border-radius: 14px;
  }
  .input {
    font-size: 18px;
    min-height: 40px;
  }
}
`;
