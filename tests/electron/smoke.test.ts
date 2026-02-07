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

    // Main content exists in sidebar renderer app, but may be clipped by WebContentsView bounds.
    const mainContent = window.locator('[data-testid="main-content"]');
    await expect(mainContent).toHaveCount(1);

    await electronApp.close();
  });

  test('layout snapshot uses content-area dimensions', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const metrics = await window.evaluate(async () => {
      const browserWindow = globalThis as unknown as Window & {
        council: {
          getLayoutSnapshot: () => Promise<{
            windowWidth: number;
            windowHeight: number;
            sidebar: { width: number; height: number };
            panes: Array<{ bounds: { height: number } }>;
          }>;
        };
      };
      const council = browserWindow.council;

      const snapshot = await council.getLayoutSnapshot();
      return {
        innerWidth: browserWindow.innerWidth,
        innerHeight: browserWindow.innerHeight,
        snapshot,
      };
    });

    expect(metrics.snapshot.windowWidth).toBeGreaterThanOrEqual(metrics.innerWidth);
    expect(metrics.snapshot.windowHeight).toBe(metrics.innerHeight);
    expect(metrics.snapshot.sidebar.width).toBe(metrics.innerWidth);
    expect(metrics.snapshot.sidebar.height).toBe(metrics.innerHeight);

    for (const pane of metrics.snapshot.panes) {
      expect(pane.bounds.height).toBe(metrics.innerHeight);
    }

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
      return (window as unknown as { council: { healthCheck: () => Promise<{ ok: boolean; runtime: string; version: string }> } }).council.healthCheck();
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

  test('sidebar toggle shortcut works', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const sidebar = window.locator('[data-testid="sidebar"]');
    const textarea = window.locator('[data-testid="prompt-textarea"]');

    await expect(sidebar).not.toHaveClass(/collapsed/);

    await window.keyboard.press('Control+B');
    await expect(sidebar).toHaveClass(/collapsed/);

    await window.keyboard.press('Control+B');
    await expect(sidebar).not.toHaveClass(/collapsed/);
    await expect(textarea).toBeFocused();

    await electronApp.close();
  });

  test('quick prompt shortcut opens centered input', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const isQuickPromptVisible = async () => {
      return window.evaluate(async () => {
        const council = (window as unknown as {
          council: {
            getLayoutSnapshot: () => Promise<{ quickPromptVisible: boolean }>;
          };
        }).council;
        const snapshot = await council.getLayoutSnapshot();
        return snapshot.quickPromptVisible;
      });
    };

    await expect.poll(isQuickPromptVisible).toBe(false);

    const paneBtn3 = window.locator('[data-testid="pane-chip-3"]');

    await window.keyboard.press('Control+J');
    await expect.poll(isQuickPromptVisible).toBe(true);
    await paneBtn3.click();
    await expect(paneBtn3).toHaveClass(/active/);

    await window.keyboard.press('Control+J');
    await expect.poll(isQuickPromptVisible).toBe(false);

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

    const snapshotAfterPane3 = await window.evaluate(() => {
      return (window as unknown as { council: { getLayoutSnapshot: () => Promise<{ paneCount: number; panes: unknown[] }> } }).council.getLayoutSnapshot();
    });
    expect(snapshotAfterPane3.paneCount).toBe(3);
    expect(snapshotAfterPane3.panes.length).toBe(3);

    // Click pane 1 button
    const paneBtn1 = window.locator('[data-testid="pane-chip-1"]');
    await paneBtn1.click();
    await expect(paneBtn1).toHaveClass(/active/);

    const snapshotAfterPane1 = await window.evaluate(() => {
      return (window as unknown as { council: { getLayoutSnapshot: () => Promise<{ paneCount: number; panes: unknown[] }> } }).council.getLayoutSnapshot();
    });
    expect(snapshotAfterPane1.paneCount).toBe(1);
    expect(snapshotAfterPane1.panes.length).toBe(1);

    await electronApp.close();
  });

  test('provider update changes pane webview target', async () => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    const updateResult = await window.evaluate(async () => {
      const council = (window as unknown as {
        council: {
          updateProvider: (request: { paneIndex: number; providerKey: string }) => Promise<{ success: boolean }>;
        };
      }).council;
      return council.updateProvider({ paneIndex: 0, providerKey: 'grok' });
    });

    expect(updateResult.success).toBe(true);

    const snapshot = await window.evaluate(() => {
      return (window as unknown as { council: { getLayoutSnapshot: () => Promise<{ panes: Array<{ providerKey: string }> }> } }).council.getLayoutSnapshot();
    });

    expect(snapshot.panes[0]?.providerKey).toBe('grok');

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
    await expect(textarea).toBeFocused();

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
