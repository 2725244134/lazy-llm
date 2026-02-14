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
  const attachmentRow = document.getElementById('quickPromptAttachmentRow') as HTMLElement | null;
  const attachmentLabel = document.getElementById('quickPromptAttachmentLabel') as HTMLElement | null;
  const attachmentClear = document.getElementById('quickPromptAttachmentClear') as HTMLButtonElement | null;
  const attachmentError = document.getElementById('quickPromptAttachmentError') as HTMLElement | null;

  let isSending = false;
  let resizeRaf = 0;
  let lastResizeHeight = 0;
  let pendingViewHeight = config.defaultViewHeight;
  let draftSyncTimer = 0;
  let draftSyncInFlight = false;
  let queuedDraftText: string | null = null;
  let lastSyncedDraftText: string | null = null;
  let suppressDraftSyncUntil = 0;
  let attachedImage: QuickPromptImagePayload | null = null;
  let attachmentErrorTimer = 0;

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

  const clearAttachmentError = (): void => {
    if (attachmentErrorTimer !== 0) {
      clearTimeout(attachmentErrorTimer);
      attachmentErrorTimer = 0;
    }

    if (!attachmentError) {
      return;
    }

    attachmentError.hidden = true;
    attachmentError.textContent = '';
  };

  const showAttachmentError = (message: string): void => {
    if (!attachmentError) {
      return;
    }

    clearAttachmentError();
    attachmentError.hidden = false;
    attachmentError.textContent = message;

    attachmentErrorTimer = window.setTimeout(() => {
      attachmentErrorTimer = 0;
      if (!attachmentError) {
        return;
      }
      attachmentError.hidden = true;
      attachmentError.textContent = '';
    }, 2600);
  };

  const formatFileSize = (sizeBytes: number): string => {
    if (sizeBytes >= 1024 * 1024) {
      return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    if (sizeBytes >= 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }

    return `${sizeBytes} B`;
  };

  const updateAttachmentUi = (): void => {
    if (!attachmentRow || !attachmentLabel) {
      return;
    }

    if (!attachedImage) {
      attachmentRow.hidden = true;
      attachmentLabel.textContent = '';
      syncPanelHeight();
      scheduleResize();
      return;
    }

    attachmentRow.hidden = false;
    attachmentLabel.textContent = `Image attached (${formatFileSize(attachedImage.sizeBytes)})`;
    syncPanelHeight();
    scheduleResize();
  };

  const clearAttachedImage = (): void => {
    attachedImage = null;
    updateAttachmentUi();
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
      showAttachmentError('Pasted image is empty.');
      return true;
    }

    if (file.size > config.maxClipboardImageBytes) {
      showAttachmentError('Image must be 8 MB or smaller.');
      return true;
    }

    try {
      const base64Data = await readImageAsBase64(file);
      attachedImage = {
        mimeType: file.type,
        base64Data,
        sizeBytes: file.size,
        source: 'clipboard',
      };
      clearAttachmentError();
      updateAttachmentUi();
      return true;
    } catch (_error) {
      showAttachmentError('Failed to process pasted image.');
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
        image: attachedImage ? { ...attachedImage } : null,
      });
      input.value = '';
      clearAttachedImage();
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

  attachmentClear?.addEventListener('click', () => {
    clearAttachedImage();
    clearAttachmentError();
    focusInput();
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
    clearAttachedImage();
    clearAttachmentError();
    syncInputHeight();
    focusInput();
  });

  window.addEventListener('quick-prompt:focus', () => {
    focusInput();
    syncInputHeight();
  });

  observePanelResize();
  updateAttachmentUi();
  syncInputHeight();
}

export function buildQuickPromptRuntimeScript(config: QuickPromptRuntimeConfig): string {
  const serializedConfig = JSON.stringify(config);
  return `(${quickPromptRuntimeEntry.toString()})(${serializedConfig});`;
}
