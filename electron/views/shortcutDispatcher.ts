export type ShortcutAction =
  | 'toggleQuickPrompt'
  | 'notifySidebarToggle'
  | 'resetAllPanes'
  | 'noop';

export interface ShortcutInput {
  type?: string;
  isAutoRepeat?: boolean;
  key?: string;
  control?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
}

function isKeyDownLike(type: string | undefined): boolean {
  return type === 'keyDown' || type === 'rawKeyDown';
}

export function resolveShortcutAction(input: ShortcutInput): ShortcutAction {
  if (!isKeyDownLike(input.type) || input.isAutoRepeat) {
    return 'noop';
  }

  const key = typeof input.key === 'string' ? input.key.toLowerCase() : '';
  const isShortcutModifier = Boolean(input.control || input.meta);
  const isBaseShortcut = isShortcutModifier && !input.alt && !input.shift;

  if (!isBaseShortcut) {
    return 'noop';
  }

  if (key === 'j') {
    return 'toggleQuickPrompt';
  }

  if (key === 'b') {
    return 'notifySidebarToggle';
  }

  if (key === 'r') {
    return 'resetAllPanes';
  }

  return 'noop';
}
