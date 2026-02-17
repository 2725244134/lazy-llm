import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_CONFIG } from '@/config';
import type {
  QuickPromptQueueEntry,
  QuickPromptQueueSnapshot,
} from '@shared-contracts/ipc/contracts';
import { SidebarSection } from './SidebarSection';
import { useSidebarContext } from './context';

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
    const roundId = (rawEntry as { roundId?: unknown }).roundId;
    const queueItemId = (rawEntry as { queueItemId?: unknown }).queueItemId;
    const text = (rawEntry as { text?: unknown }).text;
    const queuedAtMs = (rawEntry as { queuedAtMs?: unknown }).queuedAtMs;
    if (
      typeof paneIndex !== 'number'
      || !Number.isInteger(paneIndex)
      || paneIndex < 0
      || typeof roundId !== 'number'
      || !Number.isInteger(roundId)
      || roundId <= 0
      || typeof queueItemId !== 'string'
      || queueItemId.trim().length === 0
      || typeof text !== 'string'
      || text.trim().length === 0
      || typeof queuedAtMs !== 'number'
      || !Number.isFinite(queuedAtMs)
    ) {
      continue;
    }

    entries.push({
      queueItemId,
      roundId,
      paneIndex,
      text,
      queuedAtMs,
    });
  }

  entries.sort((left, right) => {
    if (left.roundId !== right.roundId) {
      return left.roundId - right.roundId;
    }
    if (left.queuedAtMs !== right.queuedAtMs) {
      return left.queuedAtMs - right.queuedAtMs;
    }
    if (left.paneIndex !== right.paneIndex) {
      return left.paneIndex - right.paneIndex;
    }
    return left.queueItemId.localeCompare(right.queueItemId);
  });

  return { entries };
}

interface QueueRoundGroup {
  roundId: number;
  entries: QuickPromptQueueEntry[];
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

function buildQueueRoundGroups(entries: QuickPromptQueueEntry[]): QueueRoundGroup[] {
  const groups: QueueRoundGroup[] = [];
  for (const entry of entries) {
    const latest = groups[groups.length - 1];
    if (!latest || latest.roundId !== entry.roundId) {
      groups.push({
        roundId: entry.roundId,
        entries: [entry],
      });
      continue;
    }
    latest.entries.push(entry);
  }
  return groups;
}

function formatMutationError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Queue operation failed';
}

export function QuickPromptQueue() {
  const {
    removeQueuedPromptItem,
    removeQueuedPromptRound,
    clearQueuedPrompts,
  } = useSidebarContext();
  const queueEventName = APP_CONFIG.interaction.shortcuts.quickPromptQueueEvent;
  const [entries, setEntries] = useState<QuickPromptQueueEntry[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [expandedRoundIds, setExpandedRoundIds] = useState<Set<number>>(() => new Set());
  const [pendingMutationKey, setPendingMutationKey] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const runQueueMutation = useCallback(
    async (mutationKey: string, action: () => Promise<number>) => {
      if (pendingMutationKey !== null) {
        return;
      }
      setPendingMutationKey(mutationKey);
      setMutationError(null);
      try {
        await action();
      } catch (error) {
        setMutationError(formatMutationError(error));
      } finally {
        setPendingMutationKey(null);
      }
    },
    [pendingMutationKey],
  );

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

  const roundGroups = useMemo(() => {
    return buildQueueRoundGroups(entries);
  }, [entries]);

  useEffect(() => {
    setExpandedRoundIds((current) => {
      const validRoundIds = new Set(roundGroups.map((group) => group.roundId));
      const nextExpanded = new Set<number>();
      for (const roundId of current) {
        if (validRoundIds.has(roundId)) {
          nextExpanded.add(roundId);
        }
      }
      const latestRoundId = roundGroups[roundGroups.length - 1]?.roundId;
      if (latestRoundId !== undefined) {
        nextExpanded.add(latestRoundId);
      }
      return nextExpanded;
    });
  }, [roundGroups]);

  const paneCount = useMemo(() => {
    return new Set(entries.map((entry) => entry.paneIndex)).size;
  }, [entries]);
  const isMutating = pendingMutationKey !== null;
  const nextQueueItemId = entries[0]?.queueItemId ?? null;
  const latestRoundId = roundGroups[roundGroups.length - 1]?.roundId ?? null;
  const totalEntries = entries.length;
  const pendingLabel = totalEntries === 1
    ? '1 pending message'
    : `${totalEntries} pending messages`;
  const paneLabel = paneCount === 1
    ? '1 pane'
    : `${paneCount} panes`;

  return (
    <SidebarSection title="QUEUE">
      <div className="queue-list">
        <div className="queue-summary" role="status" aria-live="polite">
          <span className="queue-summary-count">{pendingLabel}</span>
          <span className="queue-summary-separator">•</span>
          <span className="queue-summary-panes">{paneLabel}</span>
          <span className="queue-summary-separator">•</span>
          <span className="queue-summary-mode">FIFO by round</span>
          {entries.length > 0 ? (
            <button
              type="button"
              className="queue-summary-clear"
              disabled={isMutating}
              onClick={() => {
                void runQueueMutation('clear-all', clearQueuedPrompts);
              }}
            >
              Clear all
            </button>
          ) : null}
        </div>
        {mutationError ? (
          <p className="queue-error" role="status" aria-live="polite">
            {mutationError}
          </p>
        ) : null}
        {entries.length === 0 ? (
          <p className="queue-empty">No pending quick prompt.</p>
        ) : (
          <ol className="queue-rounds">
            {roundGroups.map((group, roundIndex) => {
              const groupRoundLabel = `Round ${roundIndex + 1}`;
              const paneCountInRound = new Set(group.entries.map((entry) => entry.paneIndex)).size;
              const paneLabelInRound = paneCountInRound === 1 ? '1 pane' : `${paneCountInRound} panes`;
              const oldestQueuedAtMs = Math.min(...group.entries.map((entry) => entry.queuedAtMs));
              const roundWaitLabel = formatQueueAgeLabel(oldestQueuedAtMs, nowMs);
              const isExpanded = expandedRoundIds.has(group.roundId);
              const isLatestRound = latestRoundId !== null && latestRoundId === group.roundId;
              const hasNextEntry = nextQueueItemId !== null
                && group.entries.some((entry) => entry.queueItemId === nextQueueItemId);
              const roundClassName = `queue-round${isExpanded ? ' is-expanded' : ''}${isLatestRound ? ' is-latest' : ''}`;
              return (
                <li key={group.roundId} className={roundClassName}>
                  <span className="queue-round-node" aria-hidden />
                  <div className="queue-round-card">
                    <div className="queue-round-header">
                      <button
                        type="button"
                        className="queue-round-toggle"
                        onClick={() => {
                          setExpandedRoundIds((current) => {
                            const next = new Set(current);
                            if (next.has(group.roundId)) {
                              next.delete(group.roundId);
                            } else {
                              next.add(group.roundId);
                            }
                            return next;
                          });
                        }}
                      >
                        {groupRoundLabel}
                      </button>
                      <div className="queue-round-meta">
                        <span className="queue-round-count">{group.entries.length} items</span>
                        <span className="queue-round-separator">•</span>
                        <span className="queue-round-panes">{paneLabelInRound}</span>
                        <span className="queue-round-separator">•</span>
                        <span className="queue-round-wait">{roundWaitLabel}</span>
                        {hasNextEntry ? (
                          <>
                            <span className="queue-round-separator">•</span>
                            <span className="queue-round-next">Next</span>
                          </>
                        ) : null}
                        {isLatestRound ? (
                          <>
                            <span className="queue-round-separator">•</span>
                            <span className="queue-round-latest">Latest</span>
                          </>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="queue-round-remove"
                        disabled={isMutating}
                        onClick={() => {
                          void runQueueMutation(
                            `remove-round:${group.roundId}`,
                            () => removeQueuedPromptRound(group.roundId)
                          );
                        }}
                      >
                        Remove round
                      </button>
                    </div>
                    {isExpanded ? (
                      <ol className="queue-items">
                        {group.entries.map((entry) => {
                          const waitLabel = formatQueueAgeLabel(entry.queuedAtMs, nowMs);
                          const isNextEntry = nextQueueItemId !== null && entry.queueItemId === nextQueueItemId;
                          const orderLabel = isNextEntry ? 'Next' : 'Queued';
                          const itemClassName = isNextEntry ? 'queue-item is-next' : 'queue-item';
                          return (
                            <li key={entry.queueItemId} className={itemClassName}>
                              <div className="queue-item-header">
                                <div className="queue-item-main">
                                  <span className="queue-item-order">{orderLabel}</span>
                                  <span className="queue-item-pane">Pane {entry.paneIndex + 1}</span>
                                  <span className="queue-item-wait">{waitLabel}</span>
                                </div>
                                <div className="queue-item-actions">
                                  <button
                                    type="button"
                                    className="queue-item-remove"
                                    disabled={isMutating}
                                    onClick={() => {
                                      void runQueueMutation(
                                        `remove-item:${entry.queueItemId}`,
                                        () => removeQueuedPromptItem(entry.queueItemId)
                                      );
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                              <p className="queue-item-text" title={entry.text}>
                                {entry.text}
                              </p>
                            </li>
                          );
                        })}
                      </ol>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </SidebarSection>
  );
}
