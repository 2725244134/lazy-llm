import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CONFIG } from '@/config';
import { useSidebarContext } from './context';

export function PromptComposer() {
  const sidebar = useSidebarContext();

  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaEl = useRef<HTMLTextAreaElement | null>(null);

  const isLoadingRef = useRef(false);
  const draftSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSyncInFlightRef = useRef(false);
  const queuedDraftTextRef = useRef<string | null>(null);
  const lastSyncedDraftTextRef = useRef<string | null>(null);
  const skipNextDraftSyncRef = useRef(false);
  const suppressDraftSyncUntilRef = useRef(0);

  const trimmedText = useMemo(() => text.trim(), [text]);
  const canSend = trimmedText.length > 0 && !isLoading;

  const minTextareaHeight = APP_CONFIG.layout.promptComposer.minTextareaHeight;
  const maxTextareaHeight = APP_CONFIG.layout.promptComposer.maxTextareaHeight;
  const draftSyncDebounceMs = APP_CONFIG.interaction.draftSync.debounceMs;
  const sendClearSyncGuardMs = APP_CONFIG.interaction.draftSync.sendClearGuardMs;

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaEl.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const nextHeight = Math.min(maxTextareaHeight, Math.max(minTextareaHeight, textarea.scrollHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxTextareaHeight ? 'auto' : 'hidden';
  }, [maxTextareaHeight, minTextareaHeight]);

  const isDraftSyncSuppressed = useCallback(() => {
    return isLoadingRef.current || Date.now() < suppressDraftSyncUntilRef.current;
  }, []);

  const flushDraftSync = useCallback(async () => {
    if (draftSyncInFlightRef.current || queuedDraftTextRef.current === null) {
      return;
    }

    if (isDraftSyncSuppressed()) {
      const delayMs = Math.max(40, suppressDraftSyncUntilRef.current - Date.now());
      if (draftSyncTimerRef.current) {
        clearTimeout(draftSyncTimerRef.current);
      }
      draftSyncTimerRef.current = setTimeout(() => {
        draftSyncTimerRef.current = null;
        void flushDraftSync();
      }, delayMs);
      return;
    }

    const textToSync = queuedDraftTextRef.current;
    queuedDraftTextRef.current = null;

    if (textToSync === lastSyncedDraftTextRef.current) {
      if (queuedDraftTextRef.current !== null) {
        void flushDraftSync();
      }
      return;
    }

    draftSyncInFlightRef.current = true;
    try {
      await sidebar.syncPromptDraft(textToSync);
      lastSyncedDraftTextRef.current = textToSync;
    } finally {
      draftSyncInFlightRef.current = false;
      if (
        queuedDraftTextRef.current !== null &&
        queuedDraftTextRef.current !== lastSyncedDraftTextRef.current
      ) {
        void flushDraftSync();
      }
    }
  }, [isDraftSyncSuppressed, sidebar]);

  const scheduleDraftSync = useCallback(
    (nextText: string) => {
      queuedDraftTextRef.current = nextText;

      if (draftSyncTimerRef.current) {
        clearTimeout(draftSyncTimerRef.current);
      }

      draftSyncTimerRef.current = setTimeout(() => {
        draftSyncTimerRef.current = null;
        void flushDraftSync();
      }, draftSyncDebounceMs);
    },
    [draftSyncDebounceMs, flushDraftSync],
  );

  const handleSend = useCallback(async () => {
    if (!canSend) {
      return;
    }

    const prompt = trimmedText;
    setIsLoading(true);
    suppressDraftSyncUntilRef.current = Date.now() + sendClearSyncGuardMs;

    try {
      await sidebar.sendPrompt(prompt);
      skipNextDraftSyncRef.current = true;
      queuedDraftTextRef.current = null;
      setText('');
      requestAnimationFrame(syncTextareaHeight);
    } finally {
      setIsLoading(false);
    }
  }, [canSend, sendClearSyncGuardMs, sidebar, syncTextareaHeight, trimmedText]);

  const handleClear = useCallback(() => {
    if (text.length === 0) {
      return;
    }
    setText('');
    requestAnimationFrame(syncTextareaHeight);
  }, [syncTextareaHeight, text.length]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter') {
        return;
      }

      if (event.shiftKey) {
        return;
      }

      if (event.ctrlKey) {
        event.preventDefault();
        handleClear();
        return;
      }

      event.preventDefault();
      void handleSend();
    },
    [handleClear, handleSend],
  );

  useEffect(() => {
    syncTextareaHeight();
  }, [syncTextareaHeight, text]);

  useEffect(() => {
    if (skipNextDraftSyncRef.current) {
      skipNextDraftSyncRef.current = false;
      return;
    }

    scheduleDraftSync(text);
  }, [scheduleDraftSync, text]);

  useEffect(() => {
    return () => {
      if (draftSyncTimerRef.current) {
        clearTimeout(draftSyncTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="composer-section">
      <textarea
        ref={textareaEl}
        value={text}
        className="composer-textarea"
        placeholder="Just prompt."
        onChange={(event) => {
          setText(event.target.value);
        }}
        onInput={syncTextareaHeight}
        onKeyDown={handleKeyDown}
      />
      <p className="composer-shortcut-hint">Enter to send · Ctrl+Enter to clear · Shift+Enter for newline</p>
      <button
        type="button"
        className={`composer-send-btn${isLoading ? ' loading' : ''}`}
        disabled={!canSend}
        onClick={() => {
          void handleSend();
        }}
      >
        SEND
      </button>
    </div>
  );
}
