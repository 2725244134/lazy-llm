import { test, expect } from '../fixtures/electronApp';
import { updateProvider } from '../helpers/council';
import { selectors } from '../helpers/selectors';

test.describe('Smoke / Panes', () => {
  test('pane selector works', async ({ appWindow }) => {
    const paneButton3 = appWindow.locator(selectors.paneChip3);
    await paneButton3.click();
    await expect(paneButton3).toHaveClass(/active/);
    await expect(appWindow.locator('.provider-list .provider-item')).toHaveCount(3);

    const paneButton1 = appWindow.locator(selectors.paneChip1);
    await paneButton1.click();
    await expect(paneButton1).toHaveClass(/active/);
    await expect(appWindow.locator('.provider-list .provider-item')).toHaveCount(1);
  });

  test('provider update changes sidebar selection state', async ({ appWindow }) => {
    const updateResult = await updateProvider(appWindow, {
      paneIndex: 0,
      providerKey: 'grok',
    });

    expect(updateResult.success).toBe(true);
    await expect(
      appWindow.locator('.provider-list .provider-item').first().locator('.trigger-label')
    ).toHaveText(/grok/i);
  });
});
