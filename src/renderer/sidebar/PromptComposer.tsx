import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CONFIG } from '@/config';
import { useSidebarContext } from './context';

const DEFAULT_DISPATCH_HINT =
  'If a pane is still responding, we queue only your latest prompt and auto-send when panes are idle.';
const QUEUED_DISPATCH_HINT =
  'Latest prompt queued. It will be sent automatically after current responses finish.';
const SENT_DISPATCH_HINT = 'Prompt sent to panes.';
const QUEUED_HINT_TIMEOUT_MS = 6000;
const SENT_HINT_TIMEOUT_MS = 2200;

export function PromptComposer() {
  const sidebar = useSidebarContext();

  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dispatchHint, setDispatchHint] = useState<{
    tone: 'queued' | 'sent';
    message: string;
  } | null>(null);
  const textareaEl = useRef<HTMLTextAreaElement | null>(null);
  const dispatchHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const scheduleDispatchHintReset = useCallback((delayMs: number) => {
    if (dispatchHintTimerRef.current) {
      clearTimeout(dispatchHintTimerRef.current);
    }

    dispatchHintTimerRef.current = setTimeout(() => {
      dispatchHintTimerRef.current = null;
      setDispatchHint(null);
    }, delayMs);
  }, []);

  const handleSend = useCallback(async () => {
    if (!canSend) {
      return;
    }

    const prompt = trimmedText;
    setIsLoading(true);
    suppressDraftSyncUntilRef.current = Date.now() + sendClearSyncGuardMs;

    try {
      const sendResult = await sidebar.sendPrompt(prompt);
      skipNextDraftSyncRef.current = true;
      queuedDraftTextRef.current = null;
      setText('');
      requestAnimationFrame(syncTextareaHeight);

      if (sendResult.queued) {
        setDispatchHint({
          tone: 'queued',
          message: QUEUED_DISPATCH_HINT,
        });
        scheduleDispatchHintReset(QUEUED_HINT_TIMEOUT_MS);
      } else {
        setDispatchHint({
          tone: 'sent',
          message: SENT_DISPATCH_HINT,
        });
        scheduleDispatchHintReset(SENT_HINT_TIMEOUT_MS);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    canSend,
    scheduleDispatchHintReset,
    sendClearSyncGuardMs,
    sidebar,
    syncTextareaHeight,
    trimmedText,
  ]);

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
      if (dispatchHintTimerRef.current) {
        clearTimeout(dispatchHintTimerRef.current);
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
      <p
        className={`composer-dispatch-hint${dispatchHint ? ` is-${dispatchHint.tone}` : ''}`}
        role="status"
        aria-live="polite"
      >
        {dispatchHint ? dispatchHint.message : DEFAULT_DISPATCH_HINT}
      </p>
    </div>
  );
}
