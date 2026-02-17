import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickSendableSubmitButton } from './submit-button';

type ButtonOptions = {
  ariaLabel?: string;
  dataTestId?: string;
  title?: string;
  id?: string;
  className?: string;
  textContent?: string;
  type?: string;
  disabled?: boolean;
  ariaDisabled?: string;
  display?: string;
};

type MockButton = HTMLButtonElement & {
  __display: string;
};

function createButton(options: ButtonOptions): MockButton {
  const attrs = new Map<string, string>();
  if (options.ariaLabel) attrs.set('aria-label', options.ariaLabel);
  if (options.dataTestId) attrs.set('data-testid', options.dataTestId);
  if (options.title) attrs.set('title', options.title);
  if (options.ariaDisabled) attrs.set('aria-disabled', options.ariaDisabled);

  const button = {
    tagName: 'BUTTON',
    type: options.type ?? 'button',
    disabled: options.disabled ?? false,
    className: options.className ?? '',
    id: options.id ?? '',
    textContent: options.textContent ?? '',
    offsetParent: options.display === 'none' ? null : {},
    __display: options.display ?? 'block',
    getAttribute(name: string): string | null {
      return attrs.get(name) ?? null;
    },
    click: vi.fn(),
  } as unknown as MockButton;

  return button;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pickSendableSubmitButton', () => {
  it('prefers a send-like button over voice-like button', () => {
    vi.stubGlobal('window', {
      getComputedStyle: (element: MockButton) => ({
        display: element.__display,
        visibility: 'visible',
      }),
    } as unknown as Window);

    const voiceButton = createButton({
      ariaLabel: 'Start Voice',
      className: 'composer-submit-button-color',
      textContent: 'Voice',
    });
    const sendButton = createButton({
      ariaLabel: 'Send message',
      dataTestId: 'send-button',
      type: 'submit',
      textContent: 'Send',
    });

    const selected = pickSendableSubmitButton([voiceButton, sendButton]);

    expect(selected).toBe(sendButton);
  });

  it('returns null when only stop-like buttons exist', () => {
    vi.stubGlobal('window', {
      getComputedStyle: (element: MockButton) => ({
        display: element.__display,
        visibility: 'visible',
      }),
    } as unknown as Window);

    const stopButton = createButton({
      ariaLabel: 'Stop response',
      textContent: 'Stop',
    });

    const selected = pickSendableSubmitButton([stopButton]);

    expect(selected).toBeNull();
  });

  it('skips aria-disabled buttons', () => {
    vi.stubGlobal('window', {
      getComputedStyle: (element: MockButton) => ({
        display: element.__display,
        visibility: 'visible',
      }),
    } as unknown as Window);

    const disabledSend = createButton({
      ariaLabel: 'Send',
      dataTestId: 'send-button',
      type: 'submit',
      ariaDisabled: 'true',
      textContent: 'Send',
    });

    const runButton = createButton({
      ariaLabel: 'Run',
      type: 'submit',
      textContent: 'Run',
    });

    const selected = pickSendableSubmitButton([disabledSend, runButton]);

    expect(selected).toBe(runButton);
  });
});
