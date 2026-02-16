import type { PromptImagePayload } from './contracts';

export const PROMPT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export type PromptImageValidationResult =
  | { ok: true; value: PromptImagePayload }
  | { ok: false; reason: string };

interface PromptImageValidationOptions {
  maxBytes?: number;
}

function resolveMaxBytes(options?: PromptImageValidationOptions): number {
  const candidate = options?.maxBytes;
  if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
    return Math.floor(candidate);
  }
  return PROMPT_IMAGE_MAX_BYTES;
}

export function validatePromptImagePayload(
  input: unknown,
  options?: PromptImageValidationOptions
): PromptImageValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: 'prompt image payload must be an object' };
  }

  const image = input as Partial<PromptImagePayload>;

  const mimeType = image.mimeType;
  if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
    return { ok: false, reason: 'prompt image mimeType must be a non-empty image/* string' };
  }

  const base64Data = image.base64Data;
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    return { ok: false, reason: 'prompt image base64Data must be a non-empty string' };
  }

  const sizeBytes = image.sizeBytes;
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, reason: 'prompt image sizeBytes must be a positive number' };
  }

  const maxBytes = resolveMaxBytes(options);
  if (sizeBytes > maxBytes) {
    return { ok: false, reason: `prompt image exceeds max allowed bytes (${maxBytes})` };
  }

  if (image.source !== 'clipboard') {
    return { ok: false, reason: 'prompt image source must be clipboard' };
  }

  return {
    ok: true,
    value: {
      mimeType,
      base64Data,
      sizeBytes,
      source: image.source,
    },
  };
}

export function normalizePromptImagePayload(
  input: unknown,
  options?: PromptImageValidationOptions
): PromptImagePayload | null {
  if (input === undefined || input === null) {
    return null;
  }

  const result = validatePromptImagePayload(input, options);
  if (!result.ok) {
    return null;
  }

  return result.value;
}
