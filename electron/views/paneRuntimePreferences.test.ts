import { describe, expect, it } from 'vitest';
import { getPaneDefaultZoomFactor } from './paneRuntimePreferences';

describe('getPaneDefaultZoomFactor', () => {
  it('uses 1.0 for linux wayland sessions', () => {
    const result = getPaneDefaultZoomFactor({
      platform: 'linux',
      xdgSessionType: 'wayland',
      waylandDisplay: 'wayland-1',
    });

    expect(result).toBe(1.0);
  });

  it('uses 1.0 when wayland display is present even if session type is empty', () => {
    const result = getPaneDefaultZoomFactor({
      platform: 'linux',
      xdgSessionType: '',
      waylandDisplay: 'wayland-1',
    });

    expect(result).toBe(1.0);
  });

  it('keeps legacy pane zoom for non-wayland environments', () => {
    const linuxX11 = getPaneDefaultZoomFactor({
      platform: 'linux',
      xdgSessionType: 'x11',
      waylandDisplay: '',
    });
    const macos = getPaneDefaultZoomFactor({
      platform: 'darwin',
      xdgSessionType: 'wayland',
      waylandDisplay: 'wayland-1',
    });

    expect(linuxX11).toBe(1.3);
    expect(macos).toBe(1.3);
  });
});
