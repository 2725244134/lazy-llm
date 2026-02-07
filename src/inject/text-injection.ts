import { reportFrontendError, toErrorMessage } from './error';

export function triggerEvents(element: HTMLElement): void {
  const events = [
    new Event('input', { bubbles: true, cancelable: true }),
    new Event('change', { bubbles: true, cancelable: true }),
    new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' }),
  ];

  for (const event of events) {
    element.dispatchEvent(event);
  }
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(element, 'value');
  const prototype = Object.getPrototypeOf(element);
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (prototypeDescriptor?.set && descriptor?.set !== prototypeDescriptor.set) {
    prototypeDescriptor.set.call(element, value);
  } else if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function handleLexicalEditor(element: HTMLElement, text: string): void {
  element.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const inserted = document.execCommand('insertText', false, text);
  if (inserted) {
    return;
  }

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  const paragraph = document.createElement('p');
  paragraph.className = 'relative';
  const span = document.createElement('span');
  span.setAttribute('data-lexical-text', 'true');
  span.textContent = text;
  paragraph.appendChild(span);
  element.appendChild(paragraph);
  triggerEvents(element);
}

function handleQuillEditor(element: HTMLElement, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  element.appendChild(paragraph);
  triggerEvents(element);

  const richTextarea = element.closest('rich-textarea');
  if (richTextarea) {
    triggerEvents(richTextarea as HTMLElement);
  }
}

function handleContentEditable(element: HTMLElement, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  element.appendChild(document.createTextNode(text));
  triggerEvents(element);

  try {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch (error) {
    reportFrontendError(
      'inject.handleContentEditable',
      `Failed to set cursor: ${toErrorMessage(error)}`,
      'inject'
    );
  }
}

export function injectText(element: HTMLElement, text: string): boolean {
  element.focus();

  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    setNativeValue(element as HTMLInputElement | HTMLTextAreaElement, text);
    triggerEvents(element);
    return true;
  }

  if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
    const isLexical = element.getAttribute('data-lexical-editor') === 'true';
    const isQuill = element.classList.contains('ql-editor') || element.closest('rich-textarea') !== null;

    if (isLexical) {
      handleLexicalEditor(element, text);
    } else if (isQuill) {
      handleQuillEditor(element, text);
    } else {
      handleContentEditable(element, text);
    }

    return true;
  }

  return false;
}
