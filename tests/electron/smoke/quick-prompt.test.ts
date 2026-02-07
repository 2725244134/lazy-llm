import { test, expect } from '../fixtures/electronApp';
import { getQuickPromptState, resizeQuickPrompt } from '../helpers/council';
import { selectors } from '../helpers/selectors';

test.describe('Smoke / Quick Prompt', () => {
  test('quick prompt shortcut opens centered input', async ({ appWindow }) => {
    const paneButton3 = appWindow.locator(selectors.paneChip3);

    await expect.poll(async () => (await getQuickPromptState(appWindow)).visible).toBe(false);

    await appWindow.evaluate(async () => {
      await window.council.toggleQuickPrompt();
    });
    await expect.poll(async () => (await getQuickPromptState(appWindow)).visible).toBe(true);

    const initialHeight = (await getQuickPromptState(appWindow)).height;
    const resizeResult = await resizeQuickPrompt(appWindow, { height: 260 });
    expect(resizeResult.success).toBe(true);

    await expect.poll(async () => (await getQuickPromptState(appWindow)).height).toBeGreaterThan(initialHeight);

    await paneButton3.click();
    await expect(paneButton3).toHaveClass(/active/);

    await appWindow.evaluate(async () => {
      await window.council.toggleQuickPrompt();
    });
    await expect.poll(async () => (await getQuickPromptState(appWindow)).visible).toBe(false);
  });
});
