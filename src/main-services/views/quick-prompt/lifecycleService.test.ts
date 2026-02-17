import { describe, expect, it, vi } from 'vitest';
import type { WebContentsView } from 'electron';
import type { ViewRect } from '@shared-contracts/ipc/contracts';
import { QuickPromptLifecycleService } from './lifecycleService';

type TestView = WebContentsView & {
  __id: string;
};

function createTestView(id: string): TestView {
  return {
    __id: id,
    setBounds: vi.fn(),
  } as unknown as TestView;
}

function createHarness() {
  const view = createTestView('quick-prompt-view');
  const addQuickPromptViewToContent = vi.fn<(view: WebContentsView) => void>();
  const removeQuickPromptViewFromContent = vi.fn<(view: WebContentsView) => void>();
  const getQuickPromptBounds = vi.fn<(height: number) => ViewRect>((height) => ({
    x: 100,
    y: 80,
    width: 800,
    height,
  }));
  const focusQuickPromptView = vi.fn<(view: WebContentsView) => void>();
  const focusSidebarIfAvailable = vi.fn<() => void>();
  const notifyQuickPromptOpened = vi.fn<(view: WebContentsView) => void>();
  const closeQuickPromptView = vi.fn<(view: WebContentsView) => void>();
  const syncQuickPromptAnchorBeforeShow = vi.fn<() => void>();
  const createQuickPromptView = vi.fn<() => WebContentsView>(() => view);

  const service = new QuickPromptLifecycleService(
    {
      defaultHeight: 72,
      minHeight: 64,
      maxHeight: 360,
    },
    {
      createQuickPromptView,
      addQuickPromptViewToContent,
      removeQuickPromptViewFromContent,
      getQuickPromptBounds,
      focusQuickPromptView,
      focusSidebarIfAvailable,
      notifyQuickPromptOpened,
      closeQuickPromptView,
      syncQuickPromptAnchorBeforeShow,
    }
  );

  return {
    service,
    view,
    createQuickPromptView,
    addQuickPromptViewToContent,
    removeQuickPromptViewFromContent,
    getQuickPromptBounds,
    focusQuickPromptView,
    focusSidebarIfAvailable,
    notifyQuickPromptOpened,
    closeQuickPromptView,
    syncQuickPromptAnchorBeforeShow,
  };
}

describe('QuickPromptLifecycleService', () => {
  it('creates the view lazily and reuses it', () => {
    const { service, createQuickPromptView, view } = createHarness();

    expect(service.getView()).toBeNull();
    expect(service.ensureView()).toBe(view);
    expect(service.ensureView()).toBe(view);
    expect(createQuickPromptView).toHaveBeenCalledTimes(1);
  });

  it('shows quick prompt with default height and focused view', () => {
    const {
      service,
      view,
      addQuickPromptViewToContent,
      getQuickPromptBounds,
      focusQuickPromptView,
      syncQuickPromptAnchorBeforeShow,
    } = createHarness();

    const visible = service.show();

    expect(visible).toBe(true);
    expect(service.isVisible()).toBe(true);
    expect(syncQuickPromptAnchorBeforeShow).toHaveBeenCalledTimes(1);
    expect(addQuickPromptViewToContent).toHaveBeenCalledWith(view);
    expect(getQuickPromptBounds).toHaveBeenCalledWith(72);
    expect(view.setBounds).toHaveBeenCalledWith({
      x: 100,
      y: 80,
      width: 800,
      height: 72,
    });
    expect(focusQuickPromptView).toHaveBeenCalledWith(view);
  });

  it('hides quick prompt and restores sidebar focus', () => {
    const {
      service,
      view,
      removeQuickPromptViewFromContent,
      focusSidebarIfAvailable,
    } = createHarness();

    service.show();
    const visible = service.hide();

    expect(visible).toBe(false);
    expect(service.isVisible()).toBe(false);
    expect(removeQuickPromptViewFromContent).toHaveBeenCalledWith(view);
    expect(focusSidebarIfAvailable).toHaveBeenCalledTimes(1);
  });

  it('hides quick prompt without restoring sidebar focus when requested', () => {
    const {
      service,
      view,
      removeQuickPromptViewFromContent,
      focusSidebarIfAvailable,
    } = createHarness();

    service.show();
    const visible = service.hide({ restoreFocus: false });

    expect(visible).toBe(false);
    expect(service.isVisible()).toBe(false);
    expect(removeQuickPromptViewFromContent).toHaveBeenCalledWith(view);
    expect(focusSidebarIfAvailable).not.toHaveBeenCalled();
  });

  it('resizes with clamp behavior and relayout only when visible', () => {
    const { service, view, getQuickPromptBounds } = createHarness();

    expect(service.resize(1000)).toEqual({
      visible: false,
      height: 360,
    });
    expect(view.setBounds).not.toHaveBeenCalled();

    service.show();
    expect(service.resize(10)).toEqual({
      visible: true,
      height: 64,
    });
    expect(getQuickPromptBounds).toHaveBeenLastCalledWith(64);
    expect(view.setBounds).toHaveBeenLastCalledWith({
      x: 100,
      y: 80,
      width: 800,
      height: 64,
    });
  });

  it('marks ready and notifies when visible', () => {
    const { service, view, notifyQuickPromptOpened } = createHarness();

    service.markReady();
    expect(notifyQuickPromptOpened).not.toHaveBeenCalled();

    service.show();
    expect(notifyQuickPromptOpened).toHaveBeenCalledWith(view);
  });

  it('relayout updates bounds only when visible', () => {
    const { service, view, getQuickPromptBounds } = createHarness();

    service.relayout();
    expect(view.setBounds).not.toHaveBeenCalled();

    service.show();
    service.resize(130);
    vi.clearAllMocks();
    service.relayout();
    expect(getQuickPromptBounds).toHaveBeenCalledWith(130);
    expect(view.setBounds).toHaveBeenCalledWith({
      x: 100,
      y: 80,
      width: 800,
      height: 130,
    });
  });

  it('destroy detaches and closes view and resets internal state', () => {
    const {
      service,
      view,
      removeQuickPromptViewFromContent,
      closeQuickPromptView,
      createQuickPromptView,
    } = createHarness();

    service.show();
    service.destroy();

    expect(removeQuickPromptViewFromContent).toHaveBeenCalledWith(view);
    expect(closeQuickPromptView).toHaveBeenCalledWith(view);
    expect(service.getView()).toBeNull();
    expect(service.isVisible()).toBe(false);

    service.ensureView();
    expect(createQuickPromptView).toHaveBeenCalledTimes(2);
  });
});
