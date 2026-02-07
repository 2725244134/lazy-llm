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
    const toggleBtn = window.locator('[data-testid="sidebar-collapse"]');

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

  test('pane selector works', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Click pane 3 button
    const paneBtn3 = window.locator('[data-testid="pane-chip-3"]');
    await paneBtn3.click();

    // Verify it becomes active
    await expect(paneBtn3).toHaveClass(/active/);

    // Click pane 1 button
    const paneBtn1 = window.locator('[data-testid="pane-chip-1"]');
    await paneBtn1.click();
    await expect(paneBtn1).toHaveClass(/active/);

    await electronApp.close();
  });

  test('prompt composer is visible and functional', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // Verify prompt textarea is visible
    const textarea = window.locator('[data-testid="prompt-textarea"]');
    await expect(textarea).toBeVisible();

    // Verify send button is visible
    const sendBtn = window.locator('[data-testid="prompt-send-btn"]');
    await expect(sendBtn).toBeVisible();

    // Send button should be disabled when empty
    await expect(sendBtn).toBeDisabled();

    // Type text and verify button becomes enabled
    await textarea.fill('Hello, world!');
    await expect(sendBtn).toBeEnabled();

    await electronApp.close();
  });
});
