import type { WebContents, WebContentsView } from 'electron';
import type {
  PaneCount,
  ProviderMeta,
} from '@shared-contracts/ipc/contracts';

export interface PaneViewState {
  view: WebContentsView;
  paneIndex: number;
  providerKey: string;
  url: string;
  cachedViews: Map<string, { view: WebContentsView; url: string }>;
}

interface PaneLifecycleCallbacks {
  createPaneWebContentsView(paneIndex: number): WebContentsView;
  addPaneViewToContent(view: WebContentsView): void;
  removePaneViewFromContent(view: WebContentsView): void;
  loadPaneUrl(paneIndex: number, view: WebContentsView, targetUrl: string, trackLoading: boolean): void;
  applyPaneRuntimePreferences(webContents: WebContents): void;
  clearProviderLoadingTracking(paneIndex: number): void;
  closePane(pane: PaneViewState): void;
  updateLayout(): void;
}

interface BaseParams {
  paneViews: PaneViewState[];
  defaultProviders: string[];
  providers: Map<string, ProviderMeta>;
  callbacks: PaneLifecycleCallbacks;
  logger?: Pick<Console, 'error'>;
}

interface SetPaneCountParams extends BaseParams {
  count: PaneCount;
  fallbackProviderKey?: string;
}

interface UpdatePaneProviderParams extends BaseParams {
  paneIndex: number;
  providerKey: string;
  areUrlsEquivalent(left: string, right: string): boolean;
}

interface ResetAllPanesParams extends BaseParams {}

export interface SetPaneCountResult {
  currentPaneCount: PaneCount;
}

function getLogger(logger?: Pick<Console, 'error'>): Pick<Console, 'error'> {
  return logger ?? console;
}

export function setPaneCountWithLifecycle(params: SetPaneCountParams): SetPaneCountResult {
  const {
    count,
    paneViews,
    defaultProviders,
    providers,
    callbacks,
    fallbackProviderKey = 'chatgpt',
  } = params;

  while (paneViews.length > count) {
    const pane = paneViews.pop()!;
    callbacks.clearProviderLoadingTracking(pane.paneIndex);
    callbacks.closePane(pane);
  }

  while (paneViews.length < count) {
    const paneIndex = paneViews.length;
    const providerKey = defaultProviders[paneIndex] ?? fallbackProviderKey;
    const provider = providers.get(providerKey);
    const url = provider?.url ?? 'about:blank';
    const view = callbacks.createPaneWebContentsView(paneIndex);

    callbacks.addPaneViewToContent(view);
    callbacks.loadPaneUrl(paneIndex, view, url, false);

    paneViews.push({
      view,
      paneIndex,
      providerKey,
      url,
      cachedViews: new Map([[providerKey, { view, url }]]),
    });
  }

  callbacks.updateLayout();

  return {
    currentPaneCount: count,
  };
}

export function updatePaneProviderWithLifecycle(params: UpdatePaneProviderParams): boolean {
  const { paneViews, defaultProviders, providers, callbacks, paneIndex, providerKey, areUrlsEquivalent } = params;
  const logger = getLogger(params.logger);

  if (paneIndex < 0 || paneIndex >= paneViews.length) {
    logger.error(`[ViewManager] Invalid pane index: ${paneIndex}`);
    return false;
  }

  const provider = providers.get(providerKey);
  if (!provider) {
    logger.error(`[ViewManager] Unknown provider: ${providerKey}`);
    return false;
  }

  const pane = paneViews[paneIndex];
  if (pane.providerKey === providerKey) {
    return true;
  }

  const cachedViewEntry = pane.cachedViews.get(providerKey);
  if (cachedViewEntry) {
    const cachedCurrentUrl = cachedViewEntry.view.webContents.getURL();
    const shouldReload = !areUrlsEquivalent(cachedViewEntry.url, provider.url)
      || !areUrlsEquivalent(cachedCurrentUrl, provider.url);

    if (shouldReload) {
      cachedViewEntry.url = provider.url;
      callbacks.applyPaneRuntimePreferences(cachedViewEntry.view.webContents);
      callbacks.loadPaneUrl(paneIndex, cachedViewEntry.view, provider.url, true);
    } else {
      callbacks.clearProviderLoadingTracking(paneIndex);
    }

    if (pane.view !== cachedViewEntry.view) {
      callbacks.removePaneViewFromContent(pane.view);
      callbacks.addPaneViewToContent(cachedViewEntry.view);
    }

    pane.view = cachedViewEntry.view;
    pane.providerKey = providerKey;
    pane.url = cachedViewEntry.url;
    defaultProviders[paneIndex] = providerKey;
    callbacks.applyPaneRuntimePreferences(pane.view.webContents);
    callbacks.updateLayout();
    return true;
  }

  const nextView = callbacks.createPaneWebContentsView(paneIndex);
  callbacks.addPaneViewToContent(nextView);
  callbacks.loadPaneUrl(paneIndex, nextView, provider.url, true);
  pane.cachedViews.set(providerKey, { view: nextView, url: provider.url });

  callbacks.removePaneViewFromContent(pane.view);
  pane.view = nextView;
  pane.providerKey = providerKey;
  pane.url = provider.url;
  defaultProviders[paneIndex] = providerKey;
  callbacks.updateLayout();

  return true;
}

export function resetAllPanesToProviderHomeWithLifecycle(params: ResetAllPanesParams): boolean {
  const { paneViews, defaultProviders, providers, callbacks } = params;
  const logger = getLogger(params.logger);
  let success = true;

  for (const pane of paneViews) {
    const provider = providers.get(pane.providerKey);
    if (!provider) {
      success = false;
      callbacks.clearProviderLoadingTracking(pane.paneIndex);
      logger.error(
        `[ViewManager] Cannot reset pane ${pane.paneIndex}: unknown provider ${pane.providerKey}`
      );
      continue;
    }

    const providerUrl = provider.url;
    const cachedViewEntry = pane.cachedViews.get(pane.providerKey);

    if (cachedViewEntry) {
      cachedViewEntry.url = providerUrl;
      if (pane.view !== cachedViewEntry.view) {
        callbacks.removePaneViewFromContent(pane.view);
        callbacks.addPaneViewToContent(cachedViewEntry.view);
      }
      pane.view = cachedViewEntry.view;
    } else {
      const nextView = callbacks.createPaneWebContentsView(pane.paneIndex);
      callbacks.addPaneViewToContent(nextView);
      pane.cachedViews.set(pane.providerKey, { view: nextView, url: providerUrl });
      callbacks.removePaneViewFromContent(pane.view);
      pane.view = nextView;
    }

    callbacks.applyPaneRuntimePreferences(pane.view.webContents);
    callbacks.loadPaneUrl(pane.paneIndex, pane.view, providerUrl, true);
    pane.url = providerUrl;
    defaultProviders[pane.paneIndex] = pane.providerKey;
  }

  callbacks.updateLayout();
  return success;
}
