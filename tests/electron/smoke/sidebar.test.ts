import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';

test.describe('Smoke / Sidebar', () => {
  test('sidebar toggle works', async ({ appWindow }) => {
    const sidebar = appWindow.locator(selectors.sidebar);
    const toggleButton = appWindow.locator(selectors.sidebarCollapse);

    await expect(sidebar).not.toHaveClass(/collapsed/);

    await toggleButton.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    await toggleButton.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('sidebar toggle shortcut works', async ({ appWindow }) => {
    const sidebar = appWindow.locator(selectors.sidebar);

    await expect(sidebar).not.toHaveClass(/collapsed/);

    await appWindow.evaluate(() => {
      window.dispatchEvent(new Event('lazyllm:shortcut-toggle-sidebar'));
    });
    await expect(sidebar).toHaveClass(/collapsed/);

    await appWindow.evaluate(() => {
      window.dispatchEvent(new Event('lazyllm:shortcut-toggle-sidebar'));
    });
    await expect(sidebar).not.toHaveClass(/collapsed/);
    await expect.poll(async () => {
      return appWindow.evaluate(() => {
        return document.activeElement?.classList.contains('composer-textarea') ?? false;
      });
    }).toBe(true);
  });
});
