import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';

test.describe('E2E / Panes', () => {
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

  test('new all button is visible and clickable', async ({ appWindow }) => {
    const newAllButton = appWindow.locator(selectors.paneNewAllButton);
    const providerItems = appWindow.locator('.provider-list .provider-item');
    const countBefore = await providerItems.count();
    await expect(newAllButton).toBeVisible();
    await newAllButton.click();
    await expect(providerItems).toHaveCount(countBefore);
  });

  test('tab shortcuts support close and left/right navigation', async ({ appWindow }) => {
    const addTabButton = appWindow.locator('.tab-add-btn');
    const tabs = appWindow.locator('.tab-chip');

    await appWindow.keyboard.press('Control+T');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toHaveClass(/active/);

    await addTabButton.click();
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(2)).toHaveClass(/active/);

    await appWindow.keyboard.press('Control+ArrowLeft');
    await expect(tabs.nth(1)).toHaveClass(/active/);

    await appWindow.keyboard.press('Control+ArrowRight');
    await expect(tabs.nth(2)).toHaveClass(/active/);

    await appWindow.keyboard.press('Control+W');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toHaveClass(/active/);
  });
});
