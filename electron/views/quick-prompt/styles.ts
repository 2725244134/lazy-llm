/**
 * Quick Prompt CSS styles
 * Style: Clear hierarchy + accessible contrast + compact spacing
 */

export const QUICK_PROMPT_STYLES = `
:root {
  color-scheme: light;
  --qp-surface: rgba(255, 255, 255, 0.97);
  --qp-surface-soft: rgba(248, 250, 252, 0.93);
  --qp-border: rgba(235, 219, 178, 0.95);
  --qp-border-focus: rgba(215, 153, 33, 0.95);
  --qp-ring: rgba(215, 153, 33, 0.24);
  --qp-inner-stroke: rgba(255, 255, 255, 0.88);
  --qp-text: #3c3836;
  --qp-placeholder: #7c6f64;
  --qp-shadow: 0 14px 28px rgba(36, 30, 21, 0.15);
  --qp-shadow-focus: 0 18px 32px rgba(62, 44, 18, 0.24);
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --qp-surface: rgba(43, 43, 43, 0.94);
    --qp-surface-soft: rgba(34, 34, 34, 0.9);
    --qp-border: rgba(168, 153, 132, 0.64);
    --qp-border-focus: rgba(250, 189, 47, 0.95);
    --qp-ring: rgba(250, 189, 47, 0.2);
    --qp-inner-stroke: rgba(235, 219, 178, 0.22);
    --qp-text: #fbf1c7;
    --qp-placeholder: #d5c4a1;
    --qp-shadow: 0 16px 34px rgba(20, 18, 16, 0.48);
    --qp-shadow-focus: 0 20px 42px rgba(20, 18, 16, 0.58);
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
    inset 0 1px 0 rgba(255, 255, 255, 0.55),
    inset 0 -1px 0 rgba(215, 153, 33, 0.24);
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
    inset 0 1px 0 rgba(255, 255, 255, 0.64),
    inset 0 -1px 0 rgba(215, 153, 33, 0.34);
}

.panel:focus-within::after {
  opacity: 0.94;
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
    border-radius: 16px;
  }
  .input {
    font-size: 18px;
    min-height: 40px;
  }
}
`;
