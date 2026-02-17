import { describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../config/app';
import { buildAppConfigPayload } from './appConfigPayload';

describe('buildAppConfigPayload', () => {
  it('maps normalized values into IPC config shape', () => {
    const providerCatalog = [
      { key: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
      { key: 'claude', name: 'Claude', url: 'https://claude.ai/' },
    ];
    const paneProviders = ['claude', 'chatgpt'];

    const payload = buildAppConfigPayload({
      paneCount: 2,
      paneProviders,
      providerCatalog,
      sidebarExpandedWidth: 320,
      quickPromptHeight: 128,
    });

    expect(payload.provider).toEqual({
      pane_count: 2,
      panes: ['claude', 'chatgpt'],
      catalog: providerCatalog,
    });
    expect(payload.sidebar).toEqual({
      expanded_width: 320,
      collapsed_width: APP_CONFIG.layout.sidebar.defaultCollapsedWidth,
    });
    expect(payload.quick_prompt.default_height).toBe(128);
  });

  it('returns cloned arrays to avoid accidental shared mutation', () => {
    const providerCatalog = [
      { key: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
    ];
    const paneProviders = ['chatgpt'];

    const payload = buildAppConfigPayload({
      paneCount: 1,
      paneProviders,
      providerCatalog,
      sidebarExpandedWidth: 280,
      quickPromptHeight: 96,
    });

    paneProviders.push('claude');
    providerCatalog[0].url = 'https://example.com/';

    expect(payload.provider.panes).toEqual(['chatgpt']);
    expect(payload.provider.catalog[0].url).toBe('https://chatgpt.com/');
  });
});
