import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper to ensure directory exists
function ensureDirectoryExistence(filePath: string) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

async function generateMock() {
  console.log('Launching browser for Mock Generation...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Please enter the URL of the LLM site you want to mock (e.g. https://chatgpt.com):');

  // Read from stdin
  const url = await new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  if (!url) {
    console.error('URL is required');
    await browser.close();
    process.exit(1);
  }

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    console.error(`Failed to navigate to ${url}:`, e);
    await browser.close();
    process.exit(1);
  }

  console.log('----------------------------------------------------------------');
  console.log('INSTRUCTIONS:');
  console.log('1. Log in to the site if necessary.');
  console.log('2. Navigate to the chat interface.');
  console.log('3. Ensure the chat input and a message are visible.');
  console.log('4. Press ENTER in this console when ready to capture.');
  console.log('----------------------------------------------------------------');

  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });

  console.log('Capturing DOM and styles...');

  // Convert relative URLs to absolute
  await page.evaluate(() => {
    const base = document.baseURI;
    document.querySelectorAll('[src]').forEach((el) => {
      if (el instanceof HTMLElement && el.hasAttribute('src')) {
         try { el.setAttribute('src', new URL(el.getAttribute('src') || '', base).href); } catch {}
      }
    });
    document.querySelectorAll('[href]').forEach((el) => {
      if (el instanceof HTMLElement && el.hasAttribute('href')) {
         try { el.setAttribute('href', new URL(el.getAttribute('href') || '', base).href); } catch {}
      }
    });
  });

  // Get full HTML
  let content = await page.content();

  // Inject a mock script to simulate interaction
  // This script will:
  // 1. Prevent actual form submission
  // 2. Intercept button clicks
  // 3. Simulate a response when "sent"
  const mockScript = `
    <script>
      (function() {
        console.log('LazyLLM Mock Script Loaded');

        // Disable external script execution if possible (difficult in pure HTML, but we can try to intercept)
        // For a mock, we mainly want the visual structure.

        // Attempt to find input and button
        // This is heuristic and might need manual adjustment in the generated file
        const inputs = document.querySelectorAll('textarea, input[type="text"]');
        const buttons = document.querySelectorAll('button');

        // Simple mock logic:
        // When any button that looks like a "send" button is clicked:
        // 1. Append a user message (cloning existing one if possible)
        // 2. Append an assistant message (cloning existing one)
        // 3. Stream text into assistant message

        // For now, just log to console to verify it loaded
      })();
    </script>
  `;

  // Append mock script before </body>
  content = content.replace('</body>', `${mockScript}</body>`);

  const outputDir = path.join(process.cwd(), 'tests', 'fixtures', 'mock-site');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `mock-${new URL(url).hostname.replace(/[^a-z0-9]/gi, '-')}.html`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, content);
  console.log(`\nMock HTML generated at: ${outputPath}`);

  // Generate a config template based on heuristics
  // We can try to guess selectors using Playwright locators or just dump a template

  const configTemplate = {
    [new URL(url).hostname]: {
      "inputSelectors": ["textarea[placeholder*='Message']", "#prompt-textarea"],
      "submitSelectors": ["button[data-testid='send-button']", "button[aria-label='Send message']"],
      "responseSelectors": [".markdown", ".message-content", ".text-message"],
      "streamingIndicatorSelectors": [".result-streaming", ".cursor"],
      "extractMode": "last"
    }
  };

  const configPath = path.join(outputDir, `config-${new URL(url).hostname.replace(/[^a-z0-9]/gi, '-')}.json`);
  fs.writeFileSync(configPath, JSON.stringify(configTemplate, null, 2));
  console.log(`Config template generated at: ${configPath}`);

  console.log('\nNEXT STEPS:');
  console.log('1. Open the generated HTML file in a browser to verify appearance.');
  console.log('2. Edit the HTML to remove unnecessary bloat (scripts, trackers).');
  console.log('3. Update the config JSON with correct CSS selectors for the elements.');

  await browser.close();
  process.exit(0);
}

generateMock().catch((err) => {
  console.error('Error generating mock:', err);
  process.exit(1);
});
