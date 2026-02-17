import { describe, expect, it, vi } from 'vitest';
import { QuickPromptController } from './controller';
import { QuickPromptAnchorTracker } from './anchorTracker';

function createController() {
  return new QuickPromptController({
    quickPromptPreloadPath: '/tmp/quick-prompt-preload.cjs',
    defaultHeight: 72,
    minHeight: 64,
    maxHeight: 320,
    resolveBounds: () => ({ x: 0, y: 0, width: 100, height: 72 }),
    anchorTracker: new QuickPromptAnchorTracker(),
    syncQuickPromptAnchorBeforeShow: () => undefined,
    addQuickPromptViewToContent: () => undefined,
    removeQuickPromptViewFromContent: () => undefined,
    keepQuickPromptViewOnTop: () => undefined,
    focusSidebarIfAvailable: () => undefined,
    attachGlobalShortcutHooks: () => undefined,
    buildQuickPromptDataUrl: () => 'data:text/html,<html></html>',
  });
}

describe('QuickPromptController.toggleQuickPrompt', () => {
  it('hides when overlay is currently visible', () => {
    const controller = createController();
    const hide = vi.fn().mockReturnValue(false);
    const show = vi.fn();

    (controller as unknown as {
      quickPromptLifecycleService: {
        isVisible: () => boolean;
        hide: typeof hide;
        show: typeof show;
      };
    }).quickPromptLifecycleService = {
      isVisible: () => true,
      hide,
      show,
    };

    const visible = controller.toggleQuickPrompt();
    expect(visible).toBe(false);
    expect(hide).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
  });

  it('shows when overlay is currently hidden', () => {
    const controller = createController();
    const hide = vi.fn();
    const show = vi.fn().mockReturnValue(true);

    (controller as unknown as {
      quickPromptLifecycleService: {
        isVisible: () => boolean;
        hide: typeof hide;
        show: typeof show;
      };
    }).quickPromptLifecycleService = {
      isVisible: () => false,
      hide,
      show,
    };

    const visible = controller.toggleQuickPrompt();
    expect(visible).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
  });
});
