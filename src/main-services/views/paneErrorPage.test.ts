import { describe, expect, it } from 'vitest';
import { buildPaneLoadErrorDataUrl } from './paneErrorPage';

const DATA_URL_PREFIX = 'data:text/html;charset=utf-8,';

function decodeErrorPageHtml(dataUrl: string): string {
  expect(dataUrl.startsWith(DATA_URL_PREFIX)).toBe(true);
  return decodeURIComponent(dataUrl.slice(DATA_URL_PREFIX.length));
}

describe('buildPaneLoadErrorDataUrl', () => {
  it('renders pane load metadata and retry action', () => {
    const dataUrl = buildPaneLoadErrorDataUrl({
      providerName: 'ChatGPT',
      targetUrl: 'https://chatgpt.com/',
      errorCode: -105,
      errorDescription: 'NAME_NOT_RESOLVED',
      attemptCount: 3,
    });

    const html = decodeErrorPageHtml(dataUrl);
    expect(html).toContain('<title>ChatGPT failed to load</title>');
    expect(html).toContain('<p>Reason: NAME_NOT_RESOLVED</p>');
    expect(html).toContain('<div>Error code: -105</div>');
    expect(html).toContain('<div>Retry attempts: 3</div>');
    expect(html).toContain('<div>Target URL: https://chatgpt.com/</div>');
    expect(html).toContain('const targetUrl = "https://chatgpt.com/";');
    expect(html).toContain('window.location.assign(targetUrl);');
  });

  it('escapes interpolated values and falls back to Unknown error text', () => {
    const dataUrl = buildPaneLoadErrorDataUrl({
      providerName: 'ACME <script> & "quotes"',
      targetUrl: 'https://example.com/query?<a>=1&b="2"&c=\'3\'',
      errorCode: -1000,
      errorDescription: '',
      attemptCount: 0,
    });

    const html = decodeErrorPageHtml(dataUrl);
    expect(html).toContain('<title>ACME &lt;script&gt; &amp; &quot;quotes&quot; failed to load</title>');
    expect(html).toContain('<p>Reason: Unknown error</p>');
    expect(html).toContain(
      '<div>Target URL: https://example.com/query?&lt;a&gt;=1&amp;b=&quot;2&quot;&amp;c=&#39;3&#39;</div>'
    );
    expect(html).not.toContain('<title>ACME <script> & "quotes" failed to load</title>');
  });
});
