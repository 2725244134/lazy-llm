/**
 * Quick Prompt client-side JavaScript
 */

export const QUICK_PROMPT_SCRIPT = `
const input = document.getElementById('quickPromptInput');
let isSending = false;
let resizeRaf = 0;
let lastResizeHeight = 0;
const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 240;
const PANEL_VERTICAL_CHROME = 25;
const DRAFT_SYNC_DEBOUNCE_MS = 90;
const SEND_CLEAR_SYNC_GUARD_MS = 650;
let pendingViewHeight = MIN_INPUT_HEIGHT + PANEL_VERTICAL_CHROME;
let draftSyncTimer = 0;
let draftSyncInFlight = false;
let queuedDraftText = null;
let lastSyncedDraftText = null;
let suppressDraftSyncUntil = 0;

const focusInput = () => {
  if (!input) return;
  input.focus();
  const cursorPos = input.value.length;
  input.setSelectionRange(cursorPos, cursorPos);
};

const pushResize = async () => {
  if (!window.quickPrompt || typeof window.quickPrompt.resize !== 'function') return;
  const measuredHeight = Math.ceil(pendingViewHeight);
  if (measuredHeight === lastResizeHeight) return;
  lastResizeHeight = measuredHeight;
  try {
    await window.quickPrompt.resize(measuredHeight);
  } catch (_error) {
    // Best effort; no-op
  }
};

const scheduleResize = () => {
  if (resizeRaf !== 0) {
    cancelAnimationFrame(resizeRaf);
  }
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    void pushResize();
  });
};

const syncInputHeight = () => {
  if (!input) return;
  input.style.height = '0px';
  const nextHeight = Math.min(
    MAX_INPUT_HEIGHT,
    Math.max(MIN_INPUT_HEIGHT, input.scrollHeight)
  );
  input.style.height = nextHeight + 'px';
  input.style.overflowY = input.scrollHeight > MAX_INPUT_HEIGHT ? 'auto' : 'hidden';
  pendingViewHeight = nextHeight + PANEL_VERTICAL_CHROME;
  scheduleResize();
};

const supportsDraftSync = () => {
  return Boolean(window.quickPrompt && typeof window.quickPrompt.syncPromptDraft === 'function');
};

const isDraftSyncSuppressed = () => {
  return isSending || Date.now() < suppressDraftSyncUntil;
};

const flushDraftSync = async () => {
  if (!supportsDraftSync() || draftSyncInFlight || queuedDraftText === null) return;

  if (isDraftSyncSuppressed()) {
    const delay = Math.max(40, suppressDraftSyncUntil - Date.now());
    if (draftSyncTimer !== 0) {
      clearTimeout(draftSyncTimer);
    }
    draftSyncTimer = window.setTimeout(() => {
      draftSyncTimer = 0;
      void flushDraftSync();
    }, delay);
    return;
  }

  const textToSync = queuedDraftText;
  queuedDraftText = null;

  if (textToSync === lastSyncedDraftText) {
    if (queuedDraftText !== null && queuedDraftText !== lastSyncedDraftText) {
      void flushDraftSync();
    }
    return;
  }

  draftSyncInFlight = true;
  try {
    await window.quickPrompt.syncPromptDraft(textToSync);
    lastSyncedDraftText = textToSync;
  } catch (_error) {
    // Best effort; no-op
  } finally {
    draftSyncInFlight = false;
    if (queuedDraftText !== null && queuedDraftText !== lastSyncedDraftText) {
      void flushDraftSync();
    }
  }
};

const scheduleDraftSync = (nextText) => {
  if (!supportsDraftSync()) return;
  queuedDraftText = nextText;
  if (draftSyncTimer !== 0) {
    clearTimeout(draftSyncTimer);
  }
  draftSyncTimer = window.setTimeout(() => {
    draftSyncTimer = 0;
    void flushDraftSync();
  }, DRAFT_SYNC_DEBOUNCE_MS);
};

const resetDraftSyncState = () => {
  if (draftSyncTimer !== 0) {
    clearTimeout(draftSyncTimer);
    draftSyncTimer = 0;
  }
  draftSyncInFlight = false;
  queuedDraftText = null;
  lastSyncedDraftText = null;
  suppressDraftSyncUntil = 0;
};

const hide = async () => {
  if (!window.quickPrompt || typeof window.quickPrompt.hide !== 'function') return;
  await window.quickPrompt.hide();
};

const submit = async () => {
  if (!input || !window.quickPrompt || typeof window.quickPrompt.sendPrompt !== 'function') return;
  const prompt = input.value.trim();
  if (!prompt || isSending) return;

  isSending = true;
  suppressDraftSyncUntil = Date.now() + SEND_CLEAR_SYNC_GUARD_MS;
  if (draftSyncTimer !== 0) {
    clearTimeout(draftSyncTimer);
    draftSyncTimer = 0;
  }
  queuedDraftText = null;
  input.disabled = true;
  try {
    await window.quickPrompt.sendPrompt(prompt);
    input.value = '';
    syncInputHeight();
    await hide();
  } finally {
    isSending = false;
    input.disabled = false;
  }
};

input?.addEventListener('input', () => {
  syncInputHeight();
  scheduleDraftSync(input.value);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    void hide();
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void submit();
  }
});

window.addEventListener('quick-prompt:open', () => {
  if (!input) return;
  resetDraftSyncState();
  input.value = '';
  input.disabled = false;
  isSending = false;
  syncInputHeight();
  focusInput();
});

window.addEventListener('quick-prompt:focus', () => {
  focusInput();
  syncInputHeight();
});

syncInputHeight();
`;
