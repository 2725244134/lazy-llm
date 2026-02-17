import { test, expect } from '../fixtures/electronApp';
import { hideQuickPrompt, resizeQuickPrompt, toggleQuickPrompt } from '../helpers/lazyllm';
import { selectors } from '../helpers/selectors';

test.describe('E2E / Quick Prompt', () => {
  test('quick prompt auto-opens and supports toggle + resize', async ({ appWindow }) => {
    const paneButton3 = appWindow.locator(selectors.paneChip3);

    const closeStartupOverlayResult = await toggleQuickPrompt(appWindow);
    expect(closeStartupOverlayResult.success).toBe(true);
    expect(closeStartupOverlayResult.visible).toBe(false);

    const openResult = await toggleQuickPrompt(appWindow);
    expect(openResult.success).toBe(true);
    expect(openResult.visible).toBe(true);

    const resizeResult = await resizeQuickPrompt(appWindow, { height: 66 });
    expect(resizeResult.success).toBe(true);
    expect(resizeResult.height).toBe(66);

    await paneButton3.click();
    await expect(paneButton3).toHaveClass(/active/);

    const reopenAfterBlurResult = await toggleQuickPrompt(appWindow);
    expect(reopenAfterBlurResult.success).toBe(true);
    expect(reopenAfterBlurResult.visible).toBe(true);

    const closeResult = await hideQuickPrompt(appWindow);
    expect(closeResult.success).toBe(true);
    expect(closeResult.visible).toBe(false);
  });
});
