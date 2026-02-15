export interface QuickPromptRuntimeConfig {
  minInputHeight: number;
  maxInputHeight: number;
  defaultViewHeight: number;
  panelHeightSafetyGap: number;
  draftSyncDebounceMs: number;
  sendClearSyncGuardMs: number;
  maxClipboardImageBytes: number;
}

interface QuickPromptImagePayload {
  mimeType: string;
  base64Data: string;
  sizeBytes: number;
  source: 'clipboard';
}

interface QuickPromptBridge {
  sendPrompt(request: { text: string; image?: QuickPromptImagePayload | null }): Promise<unknown>;
  syncPromptDraft(text: string): Promise<unknown>;
  hide(): Promise<unknown>;
  resize(height: number): Promise<unknown>;
}

declare global {
  interface Window {
    quickPrompt?: QuickPromptBridge;
  }
}

function quickPromptRuntimeEntry(config: QuickPromptRuntimeConfig): void {
  // IMPORTANT: this function body is serialized with Function#toString().
  // Do not reference identifiers outside this function scope, otherwise the
  // injected runtime will fail at execution time in the quick prompt view.
  const input = document.getElementById('quickPromptInput') as HTMLTextAreaElement | null;
  const panel = document.querySelector('.panel') as HTMLElement | null;

  let isSending = false;
  let resizeRaf = 0;
  let lastResizeHeight = 0;
  let pendingViewHeight = config.defaultViewHeight;
  let draftSyncTimer = 0;
  let draftSyncInFlight = false;
  let queuedDraftText: string | null = null;
  let lastSyncedDraftText: string | null = null;
  let suppressDraftSyncUntil = 0;
  let pendingPastedImage: QuickPromptImagePayload | null = null;

  const focusInput = (): void => {
    if (!input) {
      return;
    }
    input.focus();
    const cursorPos = input.value.length;
    input.setSelectionRange(cursorPos, cursorPos);
  };

  const pushResize = async (): Promise<void> => {
    if (!window.quickPrompt || typeof window.quickPrompt.resize !== 'function') {
      return;
    }

    const measuredHeight = Math.ceil(pendingViewHeight);
    if (measuredHeight === lastResizeHeight) {
      return;
    }

    lastResizeHeight = measuredHeight;

    try {
      await window.quickPrompt.resize(measuredHeight);
    } catch (_error) {
      // Best effort; no-op
    }
  };

  const scheduleResize = (): void => {
    if (resizeRaf !== 0) {
      cancelAnimationFrame(resizeRaf);
    }

    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      void pushResize();
    });
  };

  const syncPanelHeight = (): void => {
    if (!panel) {
      pendingViewHeight = Math.max(config.defaultViewHeight, pendingViewHeight);
      return;
    }

    const measured = panel.getBoundingClientRect().height + config.panelHeightSafetyGap;
    pendingViewHeight = Math.max(config.defaultViewHeight, Math.ceil(measured));
  };

  const syncInputHeight = (): void => {
    if (!input) {
      return;
    }

    input.style.height = '0px';

    const nextHeight = Math.min(
      config.maxInputHeight,
      Math.max(config.minInputHeight, input.scrollHeight)
    );

    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > config.maxInputHeight ? 'auto' : 'hidden';

    syncPanelHeight();
    scheduleResize();
  };

  const observePanelResize = (): void => {
    if (!panel || typeof ResizeObserver !== 'function') {
      return;
    }

    const observer = new ResizeObserver(() => {
      syncPanelHeight();
      scheduleResize();
    });

    observer.observe(panel);
  };

  const supportsDraftSync = (): boolean => {
    return Boolean(window.quickPrompt && typeof window.quickPrompt.syncPromptDraft === 'function');
  };

  const isDraftSyncSuppressed = (): boolean => {
    return isSending || Date.now() < suppressDraftSyncUntil;
  };

  const flushDraftSync = async (): Promise<void> => {
    if (!supportsDraftSync() || draftSyncInFlight || queuedDraftText === null) {
      return;
    }

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
      await window.quickPrompt?.syncPromptDraft(textToSync);
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

  const scheduleDraftSync = (nextText: string): void => {
    if (!supportsDraftSync()) {
      return;
    }

    queuedDraftText = nextText;

    if (draftSyncTimer !== 0) {
      clearTimeout(draftSyncTimer);
    }

    draftSyncTimer = window.setTimeout(() => {
      draftSyncTimer = 0;
      void flushDraftSync();
    }, config.draftSyncDebounceMs);
  };

  const resetDraftSyncState = (): void => {
    if (draftSyncTimer !== 0) {
      clearTimeout(draftSyncTimer);
      draftSyncTimer = 0;
    }

    draftSyncInFlight = false;
    queuedDraftText = null;
    lastSyncedDraftText = null;
    suppressDraftSyncUntil = 0;
  };

  const hide = async (): Promise<void> => {
    if (!window.quickPrompt || typeof window.quickPrompt.hide !== 'function') {
      return;
    }

    await window.quickPrompt.hide();
  };

  const extractBase64Data = (dataUrl: string | null): string | null => {
    if (typeof dataUrl !== 'string') {
      return null;
    }

    const delimiterIndex = dataUrl.indexOf(',');
    if (delimiterIndex < 0 || delimiterIndex >= dataUrl.length - 1) {
      return null;
    }

    return dataUrl.slice(delimiterIndex + 1);
  };

  const readImageAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('Failed to read pasted image'));
      };

      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Unexpected reader result'));
          return;
        }

        const base64Data = extractBase64Data(reader.result);
        if (!base64Data) {
          reject(new Error('Invalid data URL payload'));
          return;
        }

        resolve(base64Data);
      };

      reader.readAsDataURL(file);
    });
  };

  const attachClipboardImage = async (file: File): Promise<boolean> => {
    if (typeof file.type !== 'string' || !file.type.startsWith('image/')) {
      return false;
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      pendingPastedImage = null;
      return true;
    }

    if (file.size > config.maxClipboardImageBytes) {
      pendingPastedImage = null;
      return true;
    }

    try {
      const base64Data = await readImageAsBase64(file);
      pendingPastedImage = {
        mimeType: file.type,
        base64Data,
        sizeBytes: file.size,
        source: 'clipboard',
      };
      return true;
    } catch (_error) {
      pendingPastedImage = null;
      return true;
    }
  };

  const submit = async (): Promise<void> => {
    if (!input || !window.quickPrompt || typeof window.quickPrompt.sendPrompt !== 'function') {
      return;
    }

    const prompt = input.value.trim();
    if (!prompt || isSending) {
      return;
    }

    isSending = true;
    suppressDraftSyncUntil = Date.now() + config.sendClearSyncGuardMs;

    if (draftSyncTimer !== 0) {
      clearTimeout(draftSyncTimer);
      draftSyncTimer = 0;
    }

    queuedDraftText = null;
    input.disabled = true;

    try {
      await window.quickPrompt.sendPrompt({
        text: prompt,
        image: pendingPastedImage ? { ...pendingPastedImage } : null,
      });
      input.value = '';
      pendingPastedImage = null;
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

  input?.addEventListener('paste', (event) => {
    const clipboardItems = event.clipboardData
      ? Array.from(event.clipboardData.items || [])
      : [];

    const imageItem = clipboardItems.find((item) => {
      return item.kind === 'file' && typeof item.type === 'string' && item.type.startsWith('image/');
    });

    if (!imageItem) {
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) {
      return;
    }

    event.preventDefault();
    void attachClipboardImage(file);
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
    if (!input) {
      return;
    }

    resetDraftSyncState();
    input.disabled = false;
    isSending = false;
    pendingPastedImage = null;
    syncInputHeight();
    focusInput();
  });

  window.addEventListener('quick-prompt:focus', () => {
    focusInput();
    syncInputHeight();
  });

  observePanelResize();
  syncInputHeight();
}

export function buildQuickPromptRuntimeScript(config: QuickPromptRuntimeConfig): string {
  const serializedConfig = JSON.stringify(config);
  return `(${quickPromptRuntimeEntry.toString()})(${serializedConfig});`;
}
