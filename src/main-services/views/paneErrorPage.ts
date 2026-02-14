interface PaneLoadErrorPageOptions {
  providerName: string;
  targetUrl: string;
  errorCode: number;
  errorDescription: string;
  attemptCount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildPaneLoadErrorDataUrl(options: PaneLoadErrorPageOptions): string {
  const title = escapeHtml(`${options.providerName} failed to load`);
  const description = escapeHtml(options.errorDescription || 'Unknown error');
  const safeTargetUrl = escapeHtml(options.targetUrl);
  const serializedTargetUrl = JSON.stringify(options.targetUrl);
  const attemptText = escapeHtml(String(options.attemptCount));
  const errorCodeText = escapeHtml(String(options.errorCode));

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
      }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        font-family: "SF Pro Text", "SF Pro SC", "PingFang SC", "Segoe UI", sans-serif;
        background: #f7f8fa;
        color: #1f2937;
      }
      body {
        display: grid;
        place-items: center;
        padding: 24px;
        box-sizing: border-box;
      }
      .card {
        width: min(560px, 100%);
        background: #ffffff;
        border: 1px solid #d7dce6;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin: 0 0 10px;
        font-size: 18px;
        line-height: 1.3;
      }
      p {
        margin: 0 0 10px;
        line-height: 1.5;
      }
      .meta {
        margin-top: 12px;
        color: #4b5563;
        font-size: 13px;
        word-break: break-word;
      }
      button {
        margin-top: 14px;
        border: none;
        border-radius: 10px;
        background: #ebbcba;
        color: #1f2937;
        font-size: 14px;
        font-weight: 600;
        padding: 10px 14px;
        cursor: pointer;
      }
      button:hover {
        filter: brightness(0.98);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>Web view did not finish loading after automatic retries.</p>
      <p>Reason: ${description}</p>
      <div class="meta">
        <div>Error code: ${errorCodeText}</div>
        <div>Retry attempts: ${attemptText}</div>
        <div>Target URL: ${safeTargetUrl}</div>
      </div>
      <button id="retryButton" type="button">Retry</button>
    </div>
    <script>
      const targetUrl = ${serializedTargetUrl};
      document.getElementById('retryButton')?.addEventListener('click', () => {
        window.location.assign(targetUrl);
      });
    </script>
  </body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
