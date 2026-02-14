import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  expect,
  test as base,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { selectors } from '../helpers/selectors';

type ElectronFixtures = {
  electronApp: ElectronApplication;
  appWindow: Page;
};

type LaunchOptions = {
  mockProvidersFile?: string;
};

function createLaunchEnv(options?: LaunchOptions): Record<string, string> {
  const envEntries = Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  const userDataDir = mkdtempSync(join(tmpdir(), 'lazy-llm-e2e-'));

  const env: Record<string, string> = {
    ...Object.fromEntries(envEntries),
    NODE_ENV: 'production',
    LAZYLLM_SKIP_SINGLE_INSTANCE_LOCK: '1',
    LAZYLLM_USER_DATA_DIR: userDataDir,
  };

  if (options?.mockProvidersFile) {
    env.LAZYLLM_MOCK_PROVIDERS_FILE = options.mockProvidersFile;
  }

  return env;
}

async function hasLazyllmBridge(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  try {
    return await page.evaluate(() => {
      const bridge = globalThis as unknown as {
        lazyllm?: { healthCheck?: unknown };
      };
      return typeof bridge.lazyllm?.healthCheck === 'function';
    });
  } catch {
    return false;
  }
}

async function resolveAppWindow(electronApp: ElectronApplication): Promise<Page> {
  await electronApp.firstWindow();

  const timeoutMs = 20000;
  const pollIntervalMs = 200;
  const deadline = Date.now() + timeoutMs;
  let lastObservedWindows = '<none>';

  while (Date.now() < deadline) {
    const windows = electronApp.windows();

    for (const window of windows) {
      if (!(await hasLazyllmBridge(window))) {
        continue;
      }

      await window.waitForLoadState('domcontentloaded');
      return window;
    }

    lastObservedWindows = windows
      .map((window, index) => `${index}:${window.url() || '<empty-url>'}`)
      .join(', ') || '<none>';

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Unable to locate app window with lazyllm bridge within ${timeoutMs}ms. Windows: ${lastObservedWindows}`,
  );
}

/** Default test fixture — launches Electron without mock providers. */
export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: createLaunchEnv(),
    });

    await use(electronApp);
    await electronApp.close();
  },

  appWindow: async ({ electronApp }, use) => {
    const appPage = await resolveAppWindow(electronApp);
    await expect(appPage.locator(selectors.appLayout)).toBeVisible({ timeout: 15000 });
    await use(appPage);
  },
});

/**
 * Create a test fixture with mock providers injected.
 * The mockProvidersFile path is resolved relative to process.cwd().
 */
export function createMockTest(options: LaunchOptions) {
  return base.extend<ElectronFixtures>({
    electronApp: async ({}, use) => {
      const electronApp = await electron.launch({
        args: ['.'],
        env: createLaunchEnv(options),
      });

      await use(electronApp);
      await electronApp.close();
    },

    appWindow: async ({ electronApp }, use) => {
      const appPage = await resolveAppWindow(electronApp);
      await expect(appPage.locator(selectors.appLayout)).toBeVisible({ timeout: 15000 });
      await use(appPage);
    },
  });
}

export { expect };
