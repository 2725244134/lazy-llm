import { useEffect, useMemo, useState } from 'react';
import { APP_CONFIG } from '@/config';
import type {
  QuickPromptQueueEntry,
  QuickPromptQueueSnapshot,
} from '@shared-contracts/ipc/contracts';
import { SidebarSection } from './SidebarSection';

interface PaneQueueGroup {
  paneIndex: number;
  entries: QuickPromptQueueEntry[];
}

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

function groupEntriesByPane(entries: QuickPromptQueueEntry[]): PaneQueueGroup[] {
  const grouped = new Map<number, QuickPromptQueueEntry[]>();

  for (const entry of entries) {
    const paneEntries = grouped.get(entry.paneIndex);
    if (!paneEntries) {
      grouped.set(entry.paneIndex, [entry]);
      continue;
    }
    paneEntries.push(entry);
  }

  return Array.from(grouped.entries())
    .sort(([leftPaneIndex], [rightPaneIndex]) => leftPaneIndex - rightPaneIndex)
    .map(([paneIndex, paneEntries]) => ({
      paneIndex,
      entries: paneEntries,
    }));
}

function formatQueueAgeLabel(queuedAtMs: number, nowMs: number): string {
  const waitedMs = Math.max(0, nowMs - queuedAtMs);
  const waitedSeconds = Math.floor(waitedMs / 1000);

  if (waitedSeconds < 5) {
    return 'now';
  }
  if (waitedSeconds < 60) {
    return `${waitedSeconds}s`;
  }

  const waitedMinutes = Math.floor(waitedSeconds / 60);
  if (waitedMinutes < 60) {
    return `${waitedMinutes}m`;
  }

  const waitedHours = Math.floor(waitedMinutes / 60);
  if (waitedHours < 24) {
    return `${waitedHours}h`;
  }

  const waitedDays = Math.floor(waitedHours / 24);
  return `${waitedDays}d`;
}

export function QuickPromptQueue() {
  const queueEventName = APP_CONFIG.interaction.shortcuts.quickPromptQueueEvent;
  const [entries, setEntries] = useState<QuickPromptQueueEntry[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

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

  useEffect(() => {
    if (entries.length === 0) {
      return;
    }

    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [entries.length]);

  const paneGroups = useMemo(() => groupEntriesByPane(entries), [entries]);
  const totalEntries = entries.length;
  const totalPanes = paneGroups.length;
  const pendingLabel = totalEntries === 1
    ? '1 pending message'
    : `${totalEntries} pending messages`;
  const paneLabel = totalPanes === 1
    ? '1 pane'
    : `${totalPanes} panes`;

  return (
    <SidebarSection title="QUEUE">
      <div className="queue-list">
        <div className="queue-summary" role="status" aria-live="polite">
          <span className="queue-summary-count">{pendingLabel}</span>
          <span className="queue-summary-separator">•</span>
          <span className="queue-summary-panes">{paneLabel}</span>
        </div>
        {entries.length === 0 ? (
          <p className="queue-empty">No pending quick prompt.</p>
        ) : (
          <div className="queue-groups">
            {paneGroups.map((group) => {
              return (
                <section
                  key={`pane-${group.paneIndex}`}
                  className="queue-group"
                >
                  <div className="queue-group-header">
                    <span className="queue-group-title">Pane {group.paneIndex + 1}</span>
                    <span className="queue-group-count">{group.entries.length}</span>
                  </div>
                  <div className="queue-group-items">
                    {group.entries.map((entry, index) => {
                      const waitLabel = formatQueueAgeLabel(entry.queuedAtMs, nowMs);
                      const orderLabel = index === 0 ? 'Next' : `#${index + 1}`;
                      const itemClassName = index === 0
                        ? 'queue-item is-next'
                        : 'queue-item';
                      return (
                        <article
                          key={`${entry.paneIndex}:${entry.queuedAtMs}:${index}`}
                          className={itemClassName}
                        >
                          <div className="queue-item-header">
                            <span className="queue-item-order">{orderLabel}</span>
                            <span className="queue-item-wait">Waiting {waitLabel}</span>
                          </div>
                          <p className="queue-item-text" title={entry.text}>
                            {entry.text}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </SidebarSection>
  );
}
