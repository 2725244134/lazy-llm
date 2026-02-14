/**
 * Quick Prompt client-side JavaScript payload
 */

import { APP_CONFIG } from '@shared-config/src/app.js';
import { PROMPT_IMAGE_MAX_BYTES } from '@shared-contracts/ipc/promptImage';
import { buildQuickPromptRuntimeScript } from './runtime.js';

const quickPromptConfig = APP_CONFIG.layout.quickPrompt;
const interactionConfig = APP_CONFIG.interaction;

export const QUICK_PROMPT_SCRIPT = buildQuickPromptRuntimeScript({
  minInputHeight: quickPromptConfig.inputMinHeight,
  maxInputHeight: quickPromptConfig.inputMaxHeight,
  defaultViewHeight: quickPromptConfig.defaultHeight,
  panelHeightSafetyGap: quickPromptConfig.panelHeightSafetyGap,
  draftSyncDebounceMs: interactionConfig.draftSync.debounceMs,
  sendClearSyncGuardMs: interactionConfig.draftSync.sendClearGuardMs,
  maxClipboardImageBytes: PROMPT_IMAGE_MAX_BYTES,
});
