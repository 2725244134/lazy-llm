import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/config';
import type {
  QuickPromptQueueEntry,
  QuickPromptQueueSnapshot,
} from '@shared-contracts/ipc/contracts';
import { SidebarSection } from './SidebarSection';

function normalizeQuickPromptQueueSnapshot(detail: unknown): QuickPromptQueueSnapshot {
  if (!detail || typeof detail !== 'object') {
    return { entries: [] };
  }

  const rawEntries = (detail as { entries?: unknown }).entries;
  if (!Array.isArray(rawEntries)) {
    return { entries: [] };
  }

  const entries: QuickPromptQueueEntry[] = [];
  for (const rawEntry of rawEntries) {
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const paneIndex = (rawEntry as { paneIndex?: unknown }).paneIndex;
    const text = (rawEntry as { text?: unknown }).text;
    const queuedAtMs = (rawEntry as { queuedAtMs?: unknown }).queuedAtMs;
    if (
      typeof paneIndex !== 'number'
      || !Number.isInteger(paneIndex)
      || paneIndex < 0
      || typeof text !== 'string'
      || text.trim().length === 0
      || typeof queuedAtMs !== 'number'
      || !Number.isFinite(queuedAtMs)
    ) {
      continue;
    }

    entries.push({
      paneIndex,
      text,
      queuedAtMs,
    });
  }

  entries.sort((left, right) => {
    if (left.paneIndex !== right.paneIndex) {
      return left.paneIndex - right.paneIndex;
    }
    return left.queuedAtMs - right.queuedAtMs;
  });

  return { entries };
}

export function QuickPromptQueue() {
  const queueEventName = APP_CONFIG.interaction.shortcuts.quickPromptQueueEvent;
  const [entries, setEntries] = useState<QuickPromptQueueEntry[]>([]);

  useEffect(() => {
    const handleQueueEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      const snapshot = normalizeQuickPromptQueueSnapshot(detail);
      setEntries(snapshot.entries);
    };

    window.addEventListener(queueEventName, handleQueueEvent as EventListener);
    return () => {
      window.removeEventListener(queueEventName, handleQueueEvent as EventListener);
    };
  }, [queueEventName]);

  return (
    <SidebarSection title="QUEUE">
      <div className="queue-list">
        {entries.length === 0 ? (
          <p className="queue-empty">No pending quick prompt.</p>
        ) : (
          entries.map((entry, index) => {
            return (
              <div
                key={`${entry.paneIndex}:${entry.queuedAtMs}:${index}`}
                className="queue-item"
              >
                <div className="queue-item-header">
                  <span className="queue-item-pane">Pane {entry.paneIndex + 1}</span>
                  <span className="queue-item-order">#{index + 1}</span>
                </div>
                <p className="queue-item-text" title={entry.text}>
                  {entry.text}
                </p>
              </div>
            );
          })
        )}
      </div>
    </SidebarSection>
  );
}
