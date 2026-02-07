/**
 * Quick Prompt CSS styles
 * Style: Light floating panel + Outer glow + Bottom light bar
 */

export const QUICK_PROMPT_STYLES = `
:root {
  --qp-bg: rgba(255, 255, 255, 0.92);
  --qp-text: #1a1a1e;
  --qp-muted: rgba(0, 0, 0, 0.4);
  --qp-glow-soft: rgba(139, 92, 246, 0.15);
  --qp-bar: linear-gradient(90deg,
    transparent 0%,
    rgba(124, 58, 237, 0.7) 20%,
    rgba(139, 92, 246, 0.9) 50%,
    rgba(124, 58, 237, 0.7) 80%,
    transparent 100%
  );
  --qp-bar-idle: linear-gradient(90deg,
    transparent 0%,
    rgba(0, 0, 0, 0.05) 20%,
    rgba(0, 0, 0, 0.08) 50%,
    rgba(0, 0, 0, 0.05) 80%,
    transparent 100%
  );
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
  padding: 16px 20px 20px;
  overflow: visible;
  border-radius: 24px;
  border: none;
  background: var(--qp-bg);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 0 24px var(--qp-glow-soft);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
  transition: box-shadow 0.3s ease-out;
}

/* Subtle top highlight for depth */
.panel::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  border-radius: 1px;
  background: linear-gradient(90deg,
    transparent,
    rgba(255, 255, 255, 0.7) 30%,
    rgba(255, 255, 255, 0.9) 50%,
    rgba(255, 255, 255, 0.7) 70%,
    transparent
  );
  pointer-events: none;
}

/* Bottom light bar */
.panel::after {
  content: "";
  position: absolute;
  bottom: 6px;
  left: 32px;
  right: 32px;
  height: 3px;
  border-radius: 3px;
  background: var(--qp-bar-idle);
  opacity: 0.7;
  transition: all 0.35s ease-out;
  pointer-events: none;
}

/* Focus state: outer glow intensifies + bottom bar lights up */
.panel:focus-within {
  box-shadow:
    0 8px 40px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(139, 92, 246, 0.15),
    0 0 40px var(--qp-glow-soft),
    0 0 80px var(--qp-glow-soft);
}

.panel:focus-within::after {
  background: var(--qp-bar);
  opacity: 1;
  box-shadow: 0 0 16px rgba(139, 92, 246, 0.4);
}

.input {
  position: relative;
  z-index: 1;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--qp-text);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.01em;
  min-height: 44px;
  max-height: 260px;
  padding: 2px 0;
  resize: none;
  overflow-y: hidden;
  caret-color: rgba(139, 92, 246, 1);
}

.input::placeholder {
  color: var(--qp-muted);
  font-weight: 400;
}

.input:focus {
  outline: none;
}

/* Scrollbar styling */
.input::-webkit-scrollbar {
  width: 6px;
}

.input::-webkit-scrollbar-track {
  background: transparent;
}

.input::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 3px;
}

.input::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.5);
}

@media (max-width: 640px) {
  .panel {
    padding: 14px 16px 18px;
    border-radius: 20px;
  }
  .input {
    font-size: 18px;
    min-height: 36px;
  }
}
`;
