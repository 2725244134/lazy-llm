import { test, expect } from '../fixtures/electronApp';
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

  test('provider dropdown updates sidebar selection state', async ({ appWindow }) => {
    const firstProvider = appWindow.locator('.provider-list .provider-item').first();
    const trigger = firstProvider.locator('.select-trigger');

    await trigger.click();
    await appWindow.locator('.dropdown-menu .dropdown-item').filter({ hasText: 'Grok' }).first().click();

    await expect(firstProvider.locator('.trigger-label')).toHaveText(/grok/i);
  });
});
