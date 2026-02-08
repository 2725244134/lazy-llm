export const PANE_ACCEPT_LANGUAGES = 'en-US,en,zh-CN,zh';
export const SIDEBAR_DEFAULT_ZOOM_FACTOR = 1.0;

const PANE_DEFAULT_ZOOM_FACTOR = 1.3;
const PANE_WAYLAND_ZOOM_FACTOR = 1.0;

interface PaneZoomRuntimeContext {
  platform?: string;
  xdgSessionType?: string;
  waylandDisplay?: string;
}

export function getPaneDefaultZoomFactor(context: PaneZoomRuntimeContext = {}): number {
  const platform = context.platform ?? process.platform;
  const sessionType = (context.xdgSessionType ?? process.env.XDG_SESSION_TYPE ?? '').toLowerCase();
  const waylandDisplay = context.waylandDisplay ?? process.env.WAYLAND_DISPLAY ?? '';
  const isLinuxWayland = platform === 'linux' && (sessionType === 'wayland' || waylandDisplay !== '');

  if (isLinuxWayland) {
    return PANE_WAYLAND_ZOOM_FACTOR;
  }

  return PANE_DEFAULT_ZOOM_FACTOR;
}
