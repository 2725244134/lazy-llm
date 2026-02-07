<script setup lang="ts">
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { SIDEBAR_KEY } from './context'

const sidebar = inject(SIDEBAR_KEY)!

const text = ref('')
const isLoading = ref(false)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const trimmedText = computed(() => text.value.trim())
const MIN_TEXTAREA_HEIGHT = 92
const MAX_TEXTAREA_HEIGHT = 220

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
  try {
    await sidebar.sendPrompt(prompt)
    text.value = ''
    await nextTick()
    syncTextareaHeight()
  } finally {
    isLoading.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    void handleSend()
  }
}

watch(text, () => {
  nextTick(syncTextareaHeight)
})

onMounted(() => {
  syncTextareaHeight()
})
</script>

<template>
  <div class="composer-section">
    <textarea
      ref="textareaEl"
      v-model="text"
      class="composer-textarea"
      data-testid="prompt-textarea"
      placeholder="Type message... (Ctrl+Enter to send)"
      @input="syncTextareaHeight"
      @keydown="handleKeydown"
    ></textarea>
    <button
      class="composer-send-btn"
      :class="{ loading: isLoading }"
      :disabled="!canSend"
      data-testid="prompt-send-btn"
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
  min-height: 92px;
  max-height: 220px;
  padding: 12px 14px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  font-weight: 500;
  line-height: 1.55;
  resize: none;
  overflow-y: hidden;
  margin-bottom: 10px;
  background: var(--bg);
  color: var(--text);
  transition: all 0.2s ease-out;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.composer-textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.composer-textarea:hover {
  border-color: var(--border);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.composer-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.1);
}

.composer-send-btn {
  width: 100%;
  padding: 11px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
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
