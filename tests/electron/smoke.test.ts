import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Electron Smoke Tests', () => {
  test('app launches and shows main window', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Verify app layout is visible
    const appLayout = window.locator('[data-testid="app-layout"]');
    await expect(appLayout).toBeVisible();

    // Verify sidebar is visible
    const sidebar = window.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible();

    // Verify main content is visible
    const mainContent = window.locator('[data-testid="main-content"]');
    await expect(mainContent).toBeVisible();

    await electronApp.close();
  });

  test('IPC health check works', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Call health check via exposed API
    const health = await window.evaluate(() => {
      return window.council.healthCheck();
    });

    expect(health.ok).toBe(true);
    expect(health.runtime).toBe('electron');
    expect(typeof health.version).toBe('string');

    await electronApp.close();
  });

  test('sidebar toggle works', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const sidebar = window.locator('[data-testid="sidebar"]');
    const toggleBtn = window.locator('[data-testid="sidebar-toggle"]');

    // Initially expanded
    await expect(sidebar).not.toHaveClass(/collapsed/);

    // Click toggle
    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    // Click again to expand
    await toggleBtn.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);

    await electronApp.close();
  });
});
