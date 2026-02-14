import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';

test.describe('E2E / App Shell', () => {
  test('app launches and shows main window', async ({ appWindow }) => {
    await expect(appWindow.locator(selectors.appLayout)).toBeVisible();
    await expect(appWindow.locator(selectors.sidebar)).toBeVisible();
    await expect(appWindow.locator(selectors.mainContent)).toHaveCount(1);
  });
});
