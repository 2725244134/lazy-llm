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
  sendPrompt(request: { text: string }): Promise<unknown>;
  attachPromptImage(image: QuickPromptImagePayload): Promise<{ success?: boolean; failures?: string[] }>;
  syncPromptDraft(text: string): Promise<unknown>;
  hide(): Promise<unknown>;
  resize(height: number): Promise<unknown>;
  readClipboardImage(): QuickPromptImagePayload | null;
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
  const imageCaptureTasks = new Set<Promise<void>>();
  let imageCaptureToken = 0;
  const debugPrefix = '[QuickPromptDebug]';

  const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error && typeof error.message === 'string') {
      return error.message;
    }
    return String(error);
  };

  const stringifyDebugDetails = (details: unknown): string => {
    try {
      return JSON.stringify(details);
    } catch (_error) {
      return String(details);
    }
  };

  const logDebug = (message: string, details?: unknown): void => {
    if (details === undefined) {
      console.info(`${debugPrefix} ${message}`);
      return;
    }
    console.info(`${debugPrefix} ${message} ${stringifyDebugDetails(details)}`);
  };

  const summarizeClipboardItems = (
    items: DataTransferItem[]
  ): Array<{ kind: string; type: string }> => {
    return items.map((item) => {
      return {
        kind: item.kind,
        type: typeof item.type === 'string' ? item.type : '',
      };
    });
  };

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

  const dispatchClipboardImagePayload = async (
    payload: QuickPromptImagePayload,
    source: 'clipboardData' | 'clipboardFallback'
  ): Promise<boolean> => {
    if (!window.quickPrompt || typeof window.quickPrompt.attachPromptImage !== 'function') {
      logDebug('dispatchClipboardImagePayload: quickPrompt.attachPromptImage is unavailable', {
        source,
      });
      return false;
    }

    try {
      const dispatchResult = await window.quickPrompt.attachPromptImage(payload);
      const failures = Array.isArray(dispatchResult?.failures)
        ? dispatchResult.failures.filter((failure): failure is string => typeof failure === 'string')
        : [];
      const success = dispatchResult?.success === true;

      if (success) {
        logDebug('dispatchClipboardImagePayload: image attached to provider inputs', {
          source,
          failureCount: failures.length,
        });
      } else {
        logDebug('dispatchClipboardImagePayload: image attach returned unsuccessful result', {
          source,
          failureCount: failures.length,
          failures,
        });
      }

      return true;
    } catch (error) {
      logDebug('dispatchClipboardImagePayload: image attach threw error', {
        source,
        error: toErrorMessage(error),
      });
      return false;
    }
  };

  const attachClipboardImage = async (file: File): Promise<boolean> => {
    logDebug('attachClipboardImage: started', {
      type: file?.type ?? 'unknown',
      sizeBytes: file?.size ?? -1,
    });

    if (typeof file.type !== 'string' || !file.type.startsWith('image/')) {
      logDebug('attachClipboardImage: skipped non-image file', {
        type: file.type,
      });
      return false;
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      logDebug('attachClipboardImage: dropped image because size is invalid', {
        sizeBytes: file.size,
      });
      return true;
    }

    if (file.size > config.maxClipboardImageBytes) {
      logDebug('attachClipboardImage: image exceeds size limit and was dropped', {
        sizeBytes: file.size,
        maxClipboardImageBytes: config.maxClipboardImageBytes,
      });
      return true;
    }

    try {
      const base64Data = await readImageAsBase64(file);
      const payload: QuickPromptImagePayload = {
        mimeType: file.type,
        base64Data,
        sizeBytes: file.size,
        source: 'clipboard',
      };
      logDebug('attachClipboardImage: image captured from paste event', {
        mimeType: file.type,
        sizeBytes: file.size,
        base64Length: base64Data.length,
      });
      return dispatchClipboardImagePayload(payload, 'clipboardData');
    } catch (error) {
      logDebug('attachClipboardImage: failed to read image data', {
        error: toErrorMessage(error),
      });
      return false;
    }
  };

  const normalizeClipboardImagePayload = (
    payload: QuickPromptImagePayload | null | undefined
  ): QuickPromptImagePayload | null => {
    if (!payload) {
      return null;
    }

    if (typeof payload.mimeType !== 'string' || !payload.mimeType.startsWith('image/')) {
      return null;
    }

    if (!Number.isFinite(payload.sizeBytes) || payload.sizeBytes <= 0) {
      return null;
    }

    if (payload.sizeBytes > config.maxClipboardImageBytes) {
      return null;
    }

    if (typeof payload.base64Data !== 'string' || payload.base64Data.length === 0) {
      return null;
    }

    return {
      mimeType: payload.mimeType,
      base64Data: payload.base64Data,
      sizeBytes: payload.sizeBytes,
      source: 'clipboard',
    };
  };

  const captureImageFromSystemClipboard = (): Promise<boolean> | null => {
    if (!window.quickPrompt || typeof window.quickPrompt.readClipboardImage !== 'function') {
      logDebug('captureImageFromSystemClipboard: quickPrompt bridge unavailable');
      return null;
    }

    try {
      logDebug('captureImageFromSystemClipboard: fallback read started');
      const payload = window.quickPrompt.readClipboardImage();
      const normalized = normalizeClipboardImagePayload(payload);
      if (!normalized) {
        logDebug('captureImageFromSystemClipboard: no valid image payload from clipboard');
        return null;
      }
      logDebug('captureImageFromSystemClipboard: image captured', {
        mimeType: normalized.mimeType,
        sizeBytes: normalized.sizeBytes,
        base64Length: normalized.base64Data.length,
      });
      return dispatchClipboardImagePayload(normalized, 'clipboardFallback');
    } catch (error) {
      logDebug('captureImageFromSystemClipboard: fallback read failed', {
        error: toErrorMessage(error),
      });
      return null;
    }
  };

  const trackImageCapture = (task: Promise<boolean>): void => {
    const token = ++imageCaptureToken;
    logDebug('trackImageCapture: capture task registered', { token });
    const trackedTask = task.then(() => undefined).finally(() => {
      imageCaptureTasks.delete(trackedTask);
      logDebug('trackImageCapture: capture task settled', {
        token,
        remainingTasks: imageCaptureTasks.size,
        staleSession: imageCaptureToken !== token,
      });
    });
    imageCaptureTasks.add(trackedTask);
  };

  const submit = async (): Promise<void> => {
    if (!input || !window.quickPrompt || typeof window.quickPrompt.sendPrompt !== 'function') {
      logDebug('submit: skipped because input or bridge is unavailable');
      return;
    }

    const prompt = input.value.trim();
    if (!prompt || isSending) {
      logDebug('submit: skipped due to empty prompt or sending state', {
        promptLength: prompt.length,
        isSending,
      });
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
      if (imageCaptureTasks.size > 0) {
        logDebug('submit: waiting for image attach tasks before send', {
          taskCount: imageCaptureTasks.size,
        });
        while (imageCaptureTasks.size > 0) {
          await Promise.all(Array.from(imageCaptureTasks));
        }
        logDebug('submit: image attach tasks completed');
      }

      logDebug('submit: sending prompt payload', {
        promptLength: prompt.length,
      });
      input.value = '';
      syncInputHeight();
      void hide();
      await window.quickPrompt.sendPrompt({
        text: prompt,
      });
      logDebug('submit: prompt sent successfully');
    } catch (error) {
      logDebug('submit: send failed', {
        error: toErrorMessage(error),
      });
      throw error;
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
    logDebug('paste: event received', {
      clipboardItemCount: clipboardItems.length,
      clipboardItems: summarizeClipboardItems(clipboardItems),
      activeElementTag: document.activeElement instanceof HTMLElement
        ? document.activeElement.tagName
        : null,
    });

    const imageItem = clipboardItems.find((item) => {
      return item.kind === 'file' && typeof item.type === 'string' && item.type.startsWith('image/');
    });

    if (!imageItem) {
      logDebug('paste: no image item in clipboardData, trying system clipboard fallback');
      const fallbackCaptureTask = captureImageFromSystemClipboard();
      if (fallbackCaptureTask) {
        logDebug('paste: fallback image captured, preventing default paste behavior');
        event.preventDefault();
        trackImageCapture(fallbackCaptureTask);
      } else {
        logDebug('paste: fallback did not return an image payload');
      }
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) {
      logDebug('paste: image clipboard item returned null file');
      return;
    }

    logDebug('paste: image file extracted from clipboardData', {
      type: file.type,
      sizeBytes: file.size,
    });
    event.preventDefault();
    trackImageCapture(attachClipboardImage(file));
  });

  input?.addEventListener('keydown', (event) => {
    const keyboardEvent = event as KeyboardEvent;
    const keyCode = typeof keyboardEvent.keyCode === 'number' ? keyboardEvent.keyCode : null;
    const code = typeof keyboardEvent.code === 'string' ? keyboardEvent.code : null;
    const isEnterLike = event.key === 'Enter'
      || code === 'Enter'
      || code === 'NumpadEnter'
      || keyCode === 13;
    logDebug('input keydown observed', {
      key: event.key,
      code,
      keyCode,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      isComposing: event.isComposing,
      defaultPrevented: event.defaultPrevented,
      inputValueLength: input?.value.length ?? 0,
    });

    if (event.isComposing) {
      return;
    }

    if (isEnterLike && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      logDebug('input keydown triggers submit');
      void submit();
    }
  });

  input?.addEventListener('beforeinput', (event) => {
    const inputEvent = event as InputEvent;
    const inputType = typeof inputEvent.inputType === 'string' ? inputEvent.inputType : null;
    const isComposing = Boolean(inputEvent.isComposing);
    logDebug('input beforeinput observed', {
      inputType,
      isComposing,
      defaultPrevented: event.defaultPrevented,
      inputValueLength: input?.value.length ?? 0,
    });

    if (isComposing) {
      return;
    }

    if (inputType === 'insertLineBreak') {
      event.preventDefault();
      event.stopPropagation();
      logDebug('input beforeinput triggers submit');
      void submit();
    }
  });

  window.addEventListener('paste', (event) => {
    if (event.target === input) {
      return;
    }

    const clipboardItems = event.clipboardData
      ? Array.from(event.clipboardData.items || [])
      : [];
    logDebug('paste: observed outside quick prompt input', {
      targetTag: event.target instanceof HTMLElement ? event.target.tagName : null,
      clipboardItemCount: clipboardItems.length,
      clipboardItems: summarizeClipboardItems(clipboardItems),
    });
  }, true);

  window.addEventListener('keydown', (event) => {
    const keyboardEvent = event as KeyboardEvent;
    const keyCode = typeof keyboardEvent.keyCode === 'number' ? keyboardEvent.keyCode : null;
    const code = typeof keyboardEvent.code === 'string' ? keyboardEvent.code : null;
    const isEnterLike = event.key === 'Enter'
      || code === 'Enter'
      || code === 'NumpadEnter'
      || keyCode === 13;
    logDebug('window keydown observed', {
      key: event.key,
      code,
      keyCode,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      isComposing: event.isComposing,
      defaultPrevented: event.defaultPrevented,
    });

    if (event.isComposing) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      void hide();
      return;
    }

    if (isEnterLike && !event.shiftKey) {
      event.preventDefault();
      logDebug('window keydown triggers submit');
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
    imageCaptureToken += 1;
    imageCaptureTasks.clear();
    logDebug('quick-prompt:open reset image capture state');
    syncInputHeight();
    focusInput();
  });

  window.addEventListener('quick-prompt:focus', () => {
    focusInput();
    syncInputHeight();
  });

  window.addEventListener('quick-prompt:submit', () => {
    logDebug('quick-prompt:submit event received');
    void submit();
  });

  observePanelResize();
  syncInputHeight();
}

export function buildQuickPromptRuntimeScript(config: QuickPromptRuntimeConfig): string {
  const serializedConfig = JSON.stringify(config);
  return `(${quickPromptRuntimeEntry.toString()})(${serializedConfig});`;
}
