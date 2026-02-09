<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { SIDEBAR_KEY } from './context'
import { APP_CONFIG } from '@/config'

const sidebar = inject(SIDEBAR_KEY)!

const text = ref('')
const isLoading = ref(false)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const trimmedText = computed(() => text.value.trim())
const MIN_TEXTAREA_HEIGHT = APP_CONFIG.layout.promptComposer.minTextareaHeight
const MAX_TEXTAREA_HEIGHT = APP_CONFIG.layout.promptComposer.maxTextareaHeight
const DRAFT_SYNC_DEBOUNCE_MS = APP_CONFIG.interaction.draftSync.debounceMs
const SEND_CLEAR_SYNC_GUARD_MS = APP_CONFIG.interaction.draftSync.sendClearGuardMs

let draftSyncTimer: ReturnType<typeof setTimeout> | null = null
let draftSyncInFlight = false
let queuedDraftText: string | null = null
let lastSyncedDraftText: string | null = null
let skipNextDraftSync = false
let suppressDraftSyncUntil = 0

const canSend = computed(() => trimmedText.value.length > 0 && !isLoading.value)

const syncTextareaHeight = () => {
  const textarea = textareaEl.value
  if (!textarea) return

  textarea.style.height = 'auto'
  const nextHeight = Math.min(
    MAX_TEXTAREA_HEIGHT,
    Math.max(MIN_TEXTAREA_HEIGHT, textarea.scrollHeight)
  )

  textarea.style.height = `${nextHeight}px`
  textarea.style.overflowY = textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
}

const handleSend = async () => {
  if (!canSend.value) return
  const prompt = trimmedText.value

  isLoading.value = true
  suppressDraftSyncUntil = Date.now() + SEND_CLEAR_SYNC_GUARD_MS
  try {
    await sidebar.sendPrompt(prompt)
    skipNextDraftSync = true
    queuedDraftText = null
    text.value = ''
    await nextTick()
    syncTextareaHeight()
  } finally {
    isLoading.value = false
  }
}

const handleClear = async () => {
  if (text.value.length === 0) return
  text.value = ''
  await nextTick()
  syncTextareaHeight()
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Enter') return

  // Shift+Enter is always a newline.
  if (e.shiftKey) return

  // Ctrl+Enter clears current draft.
  if (e.ctrlKey) {
    e.preventDefault()
    void handleClear()
    return
  }

  // Enter sends the prompt.
  e.preventDefault()
  void handleSend()
}

const isDraftSyncSuppressed = () => isLoading.value || Date.now() < suppressDraftSyncUntil

const flushDraftSync = async () => {
  if (draftSyncInFlight || queuedDraftText === null) return

  if (isDraftSyncSuppressed()) {
    const delay = Math.max(40, suppressDraftSyncUntil - Date.now())
    if (draftSyncTimer) {
      clearTimeout(draftSyncTimer)
    }
    draftSyncTimer = setTimeout(() => {
      draftSyncTimer = null
      void flushDraftSync()
    }, delay)
    return
  }

  const textToSync = queuedDraftText
  queuedDraftText = null

  if (textToSync === lastSyncedDraftText) {
    if (queuedDraftText !== null) {
      void flushDraftSync()
    }
    return
  }

  draftSyncInFlight = true
  try {
    await sidebar.syncPromptDraft(textToSync)
    lastSyncedDraftText = textToSync
  } finally {
    draftSyncInFlight = false
    if (queuedDraftText !== null && queuedDraftText !== lastSyncedDraftText) {
      void flushDraftSync()
    }
  }
}

const scheduleDraftSync = (nextText: string) => {
  queuedDraftText = nextText
  if (draftSyncTimer) {
    clearTimeout(draftSyncTimer)
  }
  draftSyncTimer = setTimeout(() => {
    draftSyncTimer = null
    void flushDraftSync()
  }, DRAFT_SYNC_DEBOUNCE_MS)
}

watch(text, () => {
  nextTick(syncTextareaHeight)
  if (skipNextDraftSync) {
    skipNextDraftSync = false
    return
  }
  scheduleDraftSync(text.value)
})

onMounted(() => {
  syncTextareaHeight()
})

onBeforeUnmount(() => {
  if (draftSyncTimer) {
    clearTimeout(draftSyncTimer)
    draftSyncTimer = null
  }
})
</script>

<template>
  <div class="composer-section">
    <textarea
      ref="textareaEl"
      v-model="text"
      class="composer-textarea"
      placeholder="Just prompt."
      @input="syncTextareaHeight"
      @keydown="handleKeydown"
    ></textarea>
    <p class="composer-shortcut-hint">Enter to send · Ctrl+Enter to clear · Shift+Enter for newline</p>
    <button
      class="composer-send-btn"
      :class="{ loading: isLoading }"
      :disabled="!canSend"
      @click="void handleSend()"
    >
      SEND
    </button>
  </div>
</template>

<style scoped>
.composer-section {
  flex-shrink: 0;
  margin-top: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.composer-textarea {
  width: 100%;
  min-height: 124px;
  max-height: 280px;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  font-size: 15px;
  font-family: inherit;
  font-weight: 500;
  line-height: 1.6;
  letter-spacing: 0.1px;
  resize: none;
  overflow-y: hidden;
  margin-bottom: 10px;
  background: var(--bg);
  color: var(--text);
  caret-color: var(--broadcast);
  transition: border-color 0.2s ease-out, box-shadow 0.2s ease-out, background 0.2s ease-out;
  box-shadow: inset 0 1px 0 var(--input-inner-highlight), 0 1px 2px rgba(0, 0, 0, 0.16);
  scrollbar-width: thin;
  scrollbar-color: var(--input-scrollbar-thumb) transparent;
}

.composer-textarea::-webkit-scrollbar {
  width: 8px;
}

.composer-textarea::-webkit-scrollbar-track {
  background: transparent;
  margin: 6px 0;
}

.composer-textarea::-webkit-scrollbar-thumb {
  background: var(--input-scrollbar-thumb);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.composer-textarea:hover::-webkit-scrollbar-thumb {
  background: var(--input-scrollbar-thumb-hover);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.composer-textarea:focus::-webkit-scrollbar-thumb {
  background: var(--input-scrollbar-thumb-focus);
  border: 2px solid transparent;
  background-clip: padding-box;
}

.composer-textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.78;
}

.composer-textarea:hover {
  border-color: var(--input-border-hover);
  box-shadow: inset 0 1px 0 var(--input-inner-highlight-hover), 0 3px 10px rgba(0, 0, 0, 0.2);
}

.composer-textarea:focus {
  outline: none;
  border-color: var(--broadcast);
  background: var(--bg);
  box-shadow: 0 0 0 3px var(--input-focus-ring),
    0 10px 24px var(--input-focus-shadow);
}

.composer-shortcut-hint {
  margin: -2px 2px 10px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-muted);
  opacity: 0.82;
  overflow-wrap: anywhere;
}

.composer-send-btn {
  width: 100%;
  padding: 11px 14px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
  color: white;
  background: var(--broadcast);
  transition: all 0.2s ease-out;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.composer-send-btn:hover:not(:disabled) {
  background: var(--broadcast);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.composer-send-btn:active:not(:disabled) {
  transform: translateY(0);
}

.composer-send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.composer-send-btn.loading {
  position: relative;
  color: transparent;
}

.composer-send-btn.loading::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  top: 50%;
  left: 50%;
  margin-left: -7px;
  margin-top: -7px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
