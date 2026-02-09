import { test, expect } from '../fixtures/electronApp';
import { getHealthCheck } from '../helpers/council';

test.describe('Smoke / IPC', () => {
  test('IPC health check works', async ({ appWindow }) => {
    const health = await getHealthCheck(appWindow);

    expect(health.ok).toBe(true);
    expect(health.runtime).toBe('electron');
    expect(typeof health.version).toBe('string');
  });

  test('layout update IPC accepts pane count and sidebar width', async ({ appWindow }) => {
    const result = await appWindow.evaluate(() => {
      return window.council.updateLayout({ paneCount: 3, sidebarWidth: 320 });
    });

    expect(result.success).toBe(true);
  });
});
