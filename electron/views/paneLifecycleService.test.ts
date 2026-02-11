import { describe, expect, it, vi } from 'vitest';
import type { WebContentsView } from 'electron';
import type {
  PaneCount,
  ProviderMeta,
} from '../ipc/contracts.js';
import {
  type PaneViewState,
  resetAllPanesToProviderHomeWithLifecycle,
  setPaneCountWithLifecycle,
  updatePaneProviderWithLifecycle,
} from './paneLifecycleService';

type TestView = WebContentsView & {
  __id: string;
  __setCurrentUrl: (url: string) => void;
};

function createProvider(key: string, url: string): ProviderMeta {
  return {
    key,
    name: key,
    url,
  };
}

function createProvidersMap(entries: Array<[string, string]>): Map<string, ProviderMeta> {
  return new Map(entries.map(([key, url]) => [key, createProvider(key, url)]));
}

function createTestView(id: string, initialUrl = 'about:blank'): TestView {
  let currentUrl = initialUrl;

  return {
    __id: id,
    __setCurrentUrl: (url: string) => {
      currentUrl = url;
    },
    webContents: {
      getURL: () => currentUrl,
    },
  } as unknown as TestView;
}

function createPaneState(
  paneIndex: number,
  providerKey: string,
  view: TestView,
  url: string,
  cachedViews?: Map<string, { view: WebContentsView; url: string }>
): PaneViewState {
  return {
    paneIndex,
    providerKey,
    view,
    url,
    cachedViews: cachedViews ?? new Map([[providerKey, { view, url }]]),
  };
}

function createCallbacks() {
  const created: TestView[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const closed: number[] = [];
  const loaded: Array<{ paneIndex: number; viewId: string; targetUrl: string; trackLoading: boolean }> = [];
  const applied: string[] = [];
  const cleared: number[] = [];
  const anchored: number[] = [];
  let sequence = 0;

  const callbacks = {
    createPaneWebContentsView: (paneIndex: number) => {
      sequence += 1;
      const view = createTestView(`created-${paneIndex}-${sequence}`);
      created.push(view);
      return view;
    },
    addPaneViewToContent: (view: WebContentsView) => {
      added.push((view as TestView).__id);
    },
    removePaneViewFromContent: (view: WebContentsView) => {
      removed.push((view as TestView).__id);
    },
    loadPaneUrl: (paneIndex: number, view: WebContentsView, targetUrl: string, trackLoading: boolean) => {
      const typedView = view as TestView;
      typedView.__setCurrentUrl(targetUrl);
      loaded.push({
        paneIndex,
        viewId: typedView.__id,
        targetUrl,
        trackLoading,
      });
    },
    applyPaneRuntimePreferences: (webContents: unknown) => {
      const view = [...created].find((candidate) => candidate.webContents === webContents);
      applied.push(view?.__id ?? 'existing-view');
    },
    clearProviderLoadingTracking: (paneIndex: number) => {
      cleared.push(paneIndex);
    },
    closePane: (pane: PaneViewState) => {
      closed.push(pane.paneIndex);
    },
    keepQuickPromptOnTop: vi.fn(),
    updateLayout: vi.fn(),
    setQuickPromptAnchorPaneIndex: (paneIndex: number) => {
      anchored.push(paneIndex);
    },
  };

  return {
    callbacks,
    created,
    added,
    removed,
    closed,
    loaded,
    applied,
    cleared,
    anchored,
  };
}

describe('setPaneCountWithLifecycle', () => {
  it('adds missing panes and clamps quick prompt anchor', () => {
    const providers = createProvidersMap([
      ['chatgpt', 'https://chatgpt.com'],
      ['perplexity', 'https://www.perplexity.ai'],
    ]);
    const paneViews: PaneViewState[] = [];
    const defaultProviders = ['chatgpt', 'perplexity'];
    const { callbacks, loaded } = createCallbacks();

    const result = setPaneCountWithLifecycle({
      count: 2 as PaneCount,
      paneViews,
      defaultProviders,
      providers,
      quickPromptAnchorPaneIndex: 99,
      callbacks,
    });

    expect(result).toEqual({
      currentPaneCount: 2,
      quickPromptAnchorPaneIndex: 1,
    });
    expect(paneViews).toHaveLength(2);
    expect(paneViews[0].providerKey).toBe('chatgpt');
    expect(paneViews[1].providerKey).toBe('perplexity');
    expect(loaded).toEqual([
      {
        paneIndex: 0,
        viewId: (paneViews[0].view as TestView).__id,
        targetUrl: 'https://chatgpt.com',
        trackLoading: false,
      },
      {
        paneIndex: 1,
        viewId: (paneViews[1].view as TestView).__id,
        targetUrl: 'https://www.perplexity.ai',
        trackLoading: false,
      },
    ]);
  });

  it('removes excess panes and clears their loading tracking', () => {
    const providers = createProvidersMap([
      ['chatgpt', 'https://chatgpt.com'],
      ['claude', 'https://claude.ai/new'],
      ['gemini', 'https://gemini.google.com'],
    ]);
    const paneViews: PaneViewState[] = [
      createPaneState(0, 'chatgpt', createTestView('pane-0', 'https://chatgpt.com'), 'https://chatgpt.com'),
      createPaneState(1, 'claude', createTestView('pane-1', 'https://claude.ai/new'), 'https://claude.ai/new'),
      createPaneState(2, 'gemini', createTestView('pane-2', 'https://gemini.google.com'), 'https://gemini.google.com'),
    ];
    const defaultProviders = ['chatgpt', 'claude', 'gemini'];
    const { callbacks, closed, cleared } = createCallbacks();

    const result = setPaneCountWithLifecycle({
      count: 1 as PaneCount,
      paneViews,
      defaultProviders,
      providers,
      quickPromptAnchorPaneIndex: 2,
      callbacks,
    });

    expect(result).toEqual({
      currentPaneCount: 1,
      quickPromptAnchorPaneIndex: 0,
    });
    expect(paneViews).toHaveLength(1);
    expect(closed).toEqual([2, 1]);
    expect(cleared).toEqual([2, 1]);
  });
});

describe('updatePaneProviderWithLifecycle', () => {
  it('switches to cached view without reload when URL already matches', () => {
    const providers = createProvidersMap([
      ['chatgpt', 'https://chatgpt.com'],
      ['claude', 'https://claude.ai/new'],
    ]);
    const currentView = createTestView('current', 'https://chatgpt.com');
    const cachedClaudeView = createTestView('cached-claude', 'https://claude.ai/new');
    const pane = createPaneState(
      0,
      'chatgpt',
      currentView,
      'https://chatgpt.com',
      new Map([
        ['chatgpt', { view: currentView, url: 'https://chatgpt.com' }],
        ['claude', { view: cachedClaudeView, url: 'https://claude.ai/new' }],
      ])
    );
    const paneViews = [pane];
    const defaultProviders = ['chatgpt'];
    const { callbacks, removed, added, loaded, cleared, anchored } = createCallbacks();

    const success = updatePaneProviderWithLifecycle({
      paneIndex: 0,
      providerKey: 'claude',
      paneViews,
      defaultProviders,
      providers,
      callbacks,
      areUrlsEquivalent: (left, right) => left === right,
    });

    expect(success).toBe(true);
    expect(anchored).toEqual([0]);
    expect(loaded).toHaveLength(0);
    expect(cleared).toEqual([0]);
    expect(removed).toEqual(['current']);
    expect(added).toEqual(['cached-claude']);
    expect(pane.providerKey).toBe('claude');
    expect((pane.view as TestView).__id).toBe('cached-claude');
    expect(defaultProviders[0]).toBe('claude');
  });

  it('creates and loads a new view when target provider is not cached', () => {
    const providers = createProvidersMap([
      ['chatgpt', 'https://chatgpt.com'],
      ['gemini', 'https://gemini.google.com'],
    ]);
    const currentView = createTestView('pane-0', 'https://chatgpt.com');
    const pane = createPaneState(0, 'chatgpt', currentView, 'https://chatgpt.com');
    const paneViews = [pane];
    const defaultProviders = ['chatgpt'];
    const { callbacks, added, removed, loaded } = createCallbacks();

    const success = updatePaneProviderWithLifecycle({
      paneIndex: 0,
      providerKey: 'gemini',
      paneViews,
      defaultProviders,
      providers,
      callbacks,
      areUrlsEquivalent: (left, right) => left === right,
    });

    expect(success).toBe(true);
    expect(added).toEqual(['created-0-1']);
    expect(removed).toEqual(['pane-0']);
    expect(loaded).toEqual([
      {
        paneIndex: 0,
        viewId: 'created-0-1',
        targetUrl: 'https://gemini.google.com',
        trackLoading: true,
      },
    ]);
    expect(pane.providerKey).toBe('gemini');
    expect(pane.url).toBe('https://gemini.google.com');
    expect(defaultProviders[0]).toBe('gemini');
    expect(pane.cachedViews.has('gemini')).toBe(true);
  });
});

describe('resetAllPanesToProviderHomeWithLifecycle', () => {
  it('resets known providers and marks unknown providers as failure', () => {
    const providers = createProvidersMap([
      ['chatgpt', 'https://chatgpt.com'],
      ['claude', 'https://claude.ai/new'],
    ]);
    const unknownView = createTestView('unknown-pane', 'https://example.com');
    const chatgptMainView = createTestView('chatgpt-main', 'https://chatgpt.com/thread');
    const chatgptCachedView = createTestView('chatgpt-cached', 'https://chatgpt.com/old');
    const claudeView = createTestView('claude-pane', 'https://claude.ai/legacy');

    const paneViews: PaneViewState[] = [
      createPaneState(0, 'unknown', unknownView, 'https://example.com'),
      createPaneState(
        1,
        'chatgpt',
        chatgptMainView,
        'https://chatgpt.com/thread',
        new Map([['chatgpt', { view: chatgptCachedView, url: 'https://chatgpt.com/old' }]])
      ),
      createPaneState(2, 'claude', claudeView, 'https://claude.ai/legacy', new Map()),
    ];
    const defaultProviders = ['unknown', 'chatgpt', 'claude'];
    const { callbacks, loaded, cleared, removed, added } = createCallbacks();

    const success = resetAllPanesToProviderHomeWithLifecycle({
      paneViews,
      defaultProviders,
      providers,
      callbacks,
      logger: {
        error: vi.fn(),
      },
    });

    expect(success).toBe(false);
    expect(cleared).toEqual([0]);
    expect(removed).toEqual(['chatgpt-main', 'claude-pane']);
    expect(added).toEqual(['chatgpt-cached', 'created-2-1']);
    expect(loaded).toEqual([
      {
        paneIndex: 1,
        viewId: 'chatgpt-cached',
        targetUrl: 'https://chatgpt.com',
        trackLoading: true,
      },
      {
        paneIndex: 2,
        viewId: 'created-2-1',
        targetUrl: 'https://claude.ai/new',
        trackLoading: true,
      },
    ]);
    expect(defaultProviders).toEqual(['unknown', 'chatgpt', 'claude']);
  });
});
