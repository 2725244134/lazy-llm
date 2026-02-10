import { describe, expect, it } from 'vitest';
import { resolveShortcutAction, type ShortcutInput } from './shortcutDispatcher';

function createInput(overrides: Partial<ShortcutInput>): ShortcutInput {
  return {
    type: 'keyDown',
    isAutoRepeat: false,
    key: '',
    control: false,
    meta: false,
    alt: false,
    shift: false,
    ...overrides,
  };
}

describe('resolveShortcutAction', () => {
  it('dispatches toggleQuickPrompt for Ctrl/Cmd+J', () => {
    expect(resolveShortcutAction(createInput({ key: 'j', control: true }))).toBe('toggleQuickPrompt');
    expect(resolveShortcutAction(createInput({ key: 'J', meta: true }))).toBe('toggleQuickPrompt');
    expect(resolveShortcutAction(createInput({ type: 'rawKeyDown', key: 'j', control: true }))).toBe(
      'toggleQuickPrompt'
    );
  });

  it('dispatches notifySidebarToggle for Ctrl/Cmd+B', () => {
    expect(resolveShortcutAction(createInput({ key: 'b', control: true }))).toBe('notifySidebarToggle');
    expect(resolveShortcutAction(createInput({ key: 'B', meta: true }))).toBe('notifySidebarToggle');
  });

  it('dispatches resetAllPanes for Ctrl/Cmd+R', () => {
    expect(resolveShortcutAction(createInput({ key: 'r', control: true }))).toBe('resetAllPanes');
    expect(resolveShortcutAction(createInput({ key: 'R', meta: true }))).toBe('resetAllPanes');
  });

  it('returns noop for unsupported or ignored inputs', () => {
    expect(resolveShortcutAction(createInput({ key: 'j' }))).toBe('noop');
    expect(resolveShortcutAction(createInput({ key: 'j', control: true, shift: true }))).toBe('noop');
    expect(resolveShortcutAction(createInput({ key: 'j', control: true, alt: true }))).toBe('noop');
    expect(resolveShortcutAction(createInput({ key: 'x', control: true }))).toBe('noop');
    expect(resolveShortcutAction(createInput({ type: 'mouseDown', key: 'j', control: true }))).toBe('noop');
    expect(resolveShortcutAction(createInput({ key: 'j', control: true, isAutoRepeat: true }))).toBe(
      'noop'
    );
  });
});
